# ═══════════════════════════════════════════════════════════════════════════════
#  AI Interview Training Agent
#  DEPLOYMENT GUIDE
# ═══════════════════════════════════════════════════════════════════════════════

## PROJECT STRUCTURE

```
interview-agent/
├── app.py                  ← Flask backend + AGENT_INSTRUCTIONS
├── requirements.txt        ← Python dependencies
├── .env.example            ← Environment variable template
├── .env                    ← YOUR secrets (never commit this!)
├── .gitignore
├── Procfile                ← Heroku / Railway deployment
├── templates/
│   └── index.html          ← Full SPA frontend
├── static/
│   ├── css/style.css       ← Dark/light theme, animations
│   └── js/app.js           ← Chat, questions, dashboard logic
└── logs/
    ├── app.log             ← Application logs
    └── sessions.log        ← HR audit log (auto-created)
```

---

## STEP 1 — Prerequisites

- Python 3.10+ installed
- IBM Cloud account: https://cloud.ibm.com/registration
- watsonx.ai project created: https://dataplatform.cloud.ibm.com

---

## STEP 2 — Local Setup

```bash
# 1. Clone or download the project
cd interview-agent

# 2. Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .env       # Windows
cp  .env.example .env        # macOS/Linux

# 5. Edit .env with your IBM credentials
notepad .env                 # Windows
nano .env                    # macOS/Linux
```

---

## STEP 3 — IBM watsonx.ai Credentials

1. Log in to https://cloud.ibm.com
2. Go to **Manage → Access (IAM) → API Keys**
3. Click **"Create an IBM Cloud API key"** → copy it → paste into `.env` as `IBM_WATSONX_API_KEY`
4. Go to https://dataplatform.cloud.ibm.com
5. Create a **watsonx.ai project** or open an existing one
6. From the project URL, copy the Project ID (UUID in the URL) → paste as `IBM_WATSONX_PROJECT_ID`
7. Ensure **"Associate a Watson Machine Learning service"** is done in the project settings

---

## STEP 4 — Run Locally

```bash
# Development mode (hot reload)
FLASK_DEBUG=true python app.py

# OR via Flask CLI
flask --app app run --debug --port 5000

# OR via Gunicorn (production-like)
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

Open http://localhost:5000

---

## STEP 5 — Demo Mode (no IBM credentials)

The app runs in **Demo Mode** automatically if credentials are missing.
You'll see sample AI responses to explore the full UI without an IBM account.
The status badge in the navbar will show "Demo Mode" in red.

---

## DEPLOYMENT OPTIONS

### Option A — Heroku

```bash
# Install Heroku CLI, then:
heroku create your-interview-agent
heroku config:set IBM_WATSONX_API_KEY=your_key
heroku config:set IBM_WATSONX_PROJECT_ID=your_project_id
heroku config:set IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com
heroku config:set FLASK_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
heroku config:set WATSONX_MODEL_ID=ibm/granite-13b-instruct-v2
git push heroku main
heroku open
```

Create `Procfile` with:
```
web: gunicorn -w 2 -b 0.0.0.0:$PORT app:app
```

---

### Option B — Railway.app (Recommended — Free Tier)

1. Push code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Add all environment variables from `.env.example` in the Railway Variables tab
4. Railway auto-detects Python + `requirements.txt`
5. Deploys in ~2 minutes with HTTPS

---

### Option C — IBM Code Engine (Native IBM Cloud)

```bash
# Install IBM Cloud CLI + Code Engine plugin
ibmcloud login --apikey $IBM_CLOUD_API_KEY
ibmcloud ce project create --name interview-agent
ibmcloud ce application create \
  --name interview-app \
  --image icr.io/your-namespace/interview-agent:latest \
  --cpu 0.5 --memory 1G \
  --env IBM_WATSONX_API_KEY=$IBM_WATSONX_API_KEY \
  --env IBM_WATSONX_PROJECT_ID=$IBM_WATSONX_PROJECT_ID \
  --port 5000
```

---

### Option D — Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t interview-agent .
docker run -p 5000:5000 --env-file .env interview-agent
```

---

### Option E — Azure App Service / AWS Elastic Beanstalk

For Azure: use the Python 3.11 runtime, set env vars in Application Settings.
For AWS EB: use `eb init`, `eb create`, set env vars via `eb setenv`.

---

## CUSTOMISING THE AGENT

All agent behaviour is controlled via the `AGENT_INSTRUCTIONS` block at the
top of `app.py`, and the runtime `AGENT_CONFIG` dictionary below it.

**To change the tone:**
```python
AGENT_CONFIG["tone"] = "concise, direct, and highly technical"
```

**To add a new company:**
```python
COMPANY_DATABASE["netflix"] = {
    "name": "Netflix",
    "logo": "N",
    "culture": ["freedom and responsibility", "impact", "context not control"],
    "rounds": ["Recruiter Screen", "Hiring Manager", "Panel Loop"],
    "focus": ["Culture Fit", "Impact", "Judgment"],
    "tip": "Netflix values senior independent contributors who need no hand-holding.",
    "hr_guidelines": "Prepare answers around Netflix's Culture Deck values.",
}
```

**To blacklist a topic:**
```python
AGENT_CONFIG["blacklisted_topics"] = ["religion", "age", "family status"]
```

**To switch answer format:**
```python
AGENT_CONFIG["preferred_answer_format"] = "CAR"  # Context-Action-Result
```

---

## API ENDPOINTS

| Method | Endpoint                | Description                          |
|--------|-------------------------|--------------------------------------|
| GET    | /                       | Main SPA (HTML)                      |
| POST   | /api/chat               | AI chat session                      |
| POST   | /api/generate-questions | Generate targeted questions          |
| POST   | /api/model-answer       | Get STAR model answer                |
| POST   | /api/improve-answer     | Analyse + improve candidate answer   |
| POST   | /api/interview-plan     | Generate 30-day prep plan            |
| POST   | /api/analyze-resume     | ATS score + resume gap analysis      |
| GET    | /api/companies          | Company database JSON                |
| GET    | /api/dashboard          | Session stats + agent config         |
| POST   | /api/clear-session      | Reset session                        |
| GET    | /health                 | Health check                         |

---

## SECURITY NOTES

- `.env` is in `.gitignore` — never commit API keys
- Sessions are server-side Flask sessions (not localStorage)
- All session events logged to `logs/sessions.log` for HR audit
- Resume content is truncated to 3000 chars before sending to AI
- Token cap (1200) prevents runaway API costs
- CORS configured via `ALLOWED_ORIGINS` env var

---

## TROUBLESHOOTING

| Issue | Fix |
|-------|-----|
| "Demo Mode" showing in navbar | Add IBM credentials to `.env` |
| `ModuleNotFoundError: ibm_watsonx_ai` | Run `pip install ibm-watsonx-ai` |
| 401 Unauthorized from watsonx | Check `IBM_WATSONX_API_KEY` is correct |
| Empty responses | Increase `WATSONX_TEMPERATURE` to 0.8 |
| Slow responses (>15s) | Switch to `ibm/granite-7b-instruct` |
| CORS errors in browser | Set `ALLOWED_ORIGINS` in `.env` |

---

## FRONTEND REQUIREMENTS

The frontend is fully server-rendered (Jinja2 templates) with CDN assets.
No build step required.

CDN Dependencies (loaded automatically):
- Bootstrap 5.3.2 (CSS + JS)
- Bootstrap Icons 1.11.3
- Google Fonts (Inter, JetBrains Mono)
- Marked.js 9.1.6 (Markdown rendering)

---

*Built with IBM watsonx.ai Granite · Flask · Bootstrap 5*
