/* ═══════════════════════════════════════════════════════════════════════════
   AI Interview Training Agent — Frontend JavaScript
   IBM watsonx.ai + Flask + Bootstrap 5.3
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  currentTab:      'dashboard',
  questionsCount:  0,
  analysisCount:   0,
  confidenceScores: [],
  isDark:          true,
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadDashboard();
  autoResizeTextareas();
  setDefaultPlanDate();
});

// ─── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-bs-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('theme', theme);
  state.isDark = theme === 'dark';
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

// ─── Tab Navigation ────────────────────────────────────────────────────────────
function showTab(name, clickedEl) {
  // Hide all panes
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  // Show target
  const pane = document.getElementById('tab-' + name);
  if (pane) pane.classList.add('active');

  // Update sidebar active state on desktop
  document.querySelectorAll('.desktop-sidebar .nav-item').forEach(el => el.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  // Close offcanvas if open
  const oc = document.getElementById('sidebar');
  if (oc) {
    const bsOC = bootstrap.Offcanvas.getInstance(oc);
    if (bsOC) bsOC.hide();
  }

  state.currentTab = name;
  window.scrollTo(0, 0);
  return false;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res  = await fetch('/api/dashboard');
    const data = await res.json();

    setText('statMessages',  data.messages_count || 0);
    setText('statQuestions', state.questionsCount);
    setText('cfgModel',      data.agent_config?.model || '—');
    setText('cfgFormat',     data.agent_config?.format || 'STAR');
    setText('cfgMaxQ',       data.agent_config?.max_questions || 15);
    setText('sidebarModel',  (data.agent_config?.model || '').replace('ibm/', '').substring(0, 20));

    const badge   = document.getElementById('statusBadge');
    const dot     = badge?.querySelector('.status-dot');
    const txt     = badge?.querySelector('.status-text');
    if (data.watsonx_connected) {
      dot?.classList.add('connected');
      if (txt) txt.textContent = 'Granite Connected';
    } else {
      dot?.classList.add('error');
      if (txt) txt.textContent = 'Demo Mode';
      badge?.setAttribute('title', 'Add IBM credentials to .env to enable AI');
    }
  } catch (e) {
    console.warn('Dashboard load failed:', e);
  }
}

function updateStats() {
  setText('statQuestions', state.questionsCount);
  if (state.confidenceScores.length > 0) {
    const avg = (state.confidenceScores.reduce((a,b) => a+b, 0) / state.confidenceScores.length).toFixed(1);
    setText('statScore', avg + '/10');
  }
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
  autoResizeTextarea(e.target);
}

async function sendChatMessage() {
  const input   = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  const role    = document.getElementById('chatRole')?.value    || '';
  const company = document.getElementById('chatCompany')?.value || '';

  appendChatMsg('user', message);
  input.value = '';
  autoResizeTextarea(input);

  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  showTyping();

  try {
    const res  = await apiFetch('/api/chat', { message, role, company });
    const data = await res.json();
    removeTyping();
    appendChatMsg('coach', data.reply || data.error || 'No response.');
    // Update message count
    const cnt = document.getElementById('statMessages');
    if (cnt) cnt.textContent = parseInt(cnt.textContent || 0) + 2;
  } catch (err) {
    removeTyping();
    appendChatMsg('coach', '⚠️ Connection error. Please check your server is running.');
  }
}

function sendSuggestion(text) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; sendChatMessage(); }
}

function appendChatMsg(sender, text) {
  const win  = document.getElementById('chatWindow');
  if (!win) return;

  const isUser = sender === 'user';
  const div    = document.createElement('div');
  div.className = `chat-msg ${isUser ? 'user' : 'coach'}`;

  const time  = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const html  = isUser ? escHtml(text) : renderMarkdown(text);

  div.innerHTML = `
    <div class="msg-avatar ${isUser ? 'user-av' : 'coach-av'}">
      <i class="bi ${isUser ? 'bi-person-fill' : 'bi-cpu-fill'}"></i>
    </div>
    <div>
      <div class="msg-bubble">${html}</div>
      <div class="msg-time">${time}</div>
    </div>`;

  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function showTyping() {
  const win = document.getElementById('chatWindow');
  if (!win) return;
  const div = document.createElement('div');
  div.className = 'chat-msg coach typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar coach-av"><i class="bi bi-cpu-fill"></i></div>
    <div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function removeTyping() {
  document.getElementById('typingIndicator')?.remove();
}

function clearChat() {
  const win = document.getElementById('chatWindow');
  if (win) win.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon"><i class="bi bi-cpu-fill"></i></div>
      <h5>Chat cleared. Ready to help!</h5>
      <p>Ask me anything about interview preparation.</p>
    </div>`;
  fetch('/api/clear-session', {method:'POST'});
}

// ─── Generate Questions ──────────────────────────────────────────────────────
async function generateQuestions() {
  const role    = document.getElementById('qRole')?.value.trim();
  if (!role) { showToast('Please enter a job title / role.', 'warning'); return; }

  const payload = {
    role,
    experience:    document.getElementById('qExperience')?.value     || 'Mid-level',
    company:       document.getElementById('qCompany')?.value        || '',
    difficulty:    document.querySelector('input[name="difficulty"]:checked')?.value || 'Intermediate',
    num_questions: document.getElementById('qNumQuestions')?.value   || 5,
    resume:        document.getElementById('qResume')?.value         || '',
  };

  showLoading('Generating personalised questions...');
  try {
    const res  = await apiFetch('/api/generate-questions', payload);
    const data = await res.json();
    hideLoading();

    const panel = document.getElementById('questionsResult');
    if (!panel) return;

    state.questionsCount += parseInt(payload.num_questions);
    updateStats();

    // Parse and render questions
    const questions = parseQuestions(data.questions);
    const compInfo  = data.company_info;

    let html = `<div class="result-content">`;

    if (compInfo) {
      html += `<div class="tip-box mb-4">
        <i class="bi bi-lightbulb-fill text-warning"></i>
        <div><strong>${compInfo.name} Insider Tip:</strong><br/><span class="small">${compInfo.tip}</span></div>
      </div>`;
    }

    html += `<div class="d-flex align-items-center justify-content-between mb-3">
      <h6 class="mb-0 fw-semibold"><i class="bi bi-question-circle-fill text-primary me-2"></i>${questions.length} Questions Generated</h6>
      <button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyResultText('questionsResult')">
        <i class="bi bi-clipboard me-1"></i>Copy All
      </button>
    </div>`;

    if (questions.length > 0) {
      questions.forEach((q, i) => {
        const typeClass = getBadgeClass(q.type);
        html += `<div class="question-item" onclick="useQuestion('${escAttr(q.text)}', '${escAttr(role)}')">
          <div class="d-flex align-items-start gap-3">
            <div class="q-number">${i+1}</div>
            <div class="flex-grow-1">
              <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                ${q.type ? `<span class="q-type-badge ${typeClass}">${q.type}</span>` : ''}
                ${q.difficulty ? `<span class="badge bg-secondary bg-opacity-50 text-secondary" style="font-size:10px">${q.difficulty}</span>` : ''}
              </div>
              <p class="mb-0" style="font-size:14px">${escHtml(q.text)}</p>
              <div class="mt-2 d-flex gap-2">
                <button class="btn btn-xs btn-outline-primary" style="font-size:11px;padding:2px 8px"
                  onclick="event.stopPropagation();getModelAnswerFor('${escAttr(q.text)}', '${escAttr(role)}')">
                  <i class="bi bi-stars me-1"></i>Model Answer
                </button>
                <button class="btn btn-xs btn-outline-secondary" style="font-size:11px;padding:2px 8px"
                  onclick="event.stopPropagation();practiceQuestion('${escAttr(q.text)}')">
                  <i class="bi bi-pencil me-1"></i>Practice
                </button>
              </div>
            </div>
          </div>
        </div>`;
      });
    } else {
      html += `<div class="p-3">${renderMarkdown(data.questions)}</div>`;
    }

    html += `</div>`;
    panel.innerHTML = html;
  } catch (err) {
    hideLoading();
    showToast('Generation failed. Check server logs.', 'danger');
  }
}

function parseQuestions(raw) {
  const lines = raw.split('\n');
  const questions = [];
  let current = null;

  for (const line of lines) {
    const qMatch = line.match(/^Q?\d+[\.\)]\s+(.+)/i);
    if (qMatch) {
      if (current) questions.push(current);
      current = { text: qMatch[1].trim(), type: '', difficulty: '' };
    } else if (current) {
      const typeMatch = line.match(/^Type:\s*(.+)/i);
      const diffMatch = line.match(/^Difficulty:\s*(.+)/i);
      if (typeMatch) current.type = typeMatch[1].trim();
      if (diffMatch) current.difficulty = diffMatch[1].trim();
    }
  }
  if (current) questions.push(current);
  return questions;
}

function getBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('behav')) return 'badge-behavioural';
  if (t.includes('tech'))  return 'badge-technical';
  if (t.includes('situ'))  return 'badge-situational';
  return 'badge-competency';
}

// ─── Model Answer ─────────────────────────────────────────────────────────────
async function getModelAnswer() {
  const question = document.getElementById('improveQuestion')?.value.trim();
  const role     = document.getElementById('improveRole')?.value.trim()     || '';
  if (!question) { showToast('Please enter a question first.', 'warning'); return; }

  showLoading('Generating model answer...');
  try {
    const res  = await apiFetch('/api/model-answer', { question, role, company: '' });
    const data = await res.json();
    hideLoading();
    renderResult('improveResult', data.answer, 'Model Answer');
  } catch (err) {
    hideLoading();
    showToast('Failed to get model answer.', 'danger');
  }
}

async function getModelAnswerFor(question, role) {
  showTab('improve', null);
  document.getElementById('improveQuestion').value = question;
  document.getElementById('improveRole').value     = role;
  showLoading('Generating model answer...');
  try {
    const res  = await apiFetch('/api/model-answer', { question, role, company: '' });
    const data = await res.json();
    hideLoading();
    renderResult('improveResult', data.answer, 'Model Answer');
  } catch (err) {
    hideLoading();
    showToast('Failed.', 'danger');
  }
}

// ─── Analyse Answer ────────────────────────────────────────────────────────────
async function analyseAnswer() {
  const question = document.getElementById('improveQuestion')?.value.trim();
  const answer   = document.getElementById('improveAnswer')?.value.trim();
  const role     = document.getElementById('improveRole')?.value.trim() || '';

  if (!question || !answer) {
    showToast('Please enter both a question and your answer.', 'warning');
    return;
  }

  showLoading('Analysing your answer...');
  try {
    const res  = await apiFetch('/api/improve-answer', { question, candidate_answer: answer, role });
    const data = await res.json();
    hideLoading();

    // Extract confidence score if present
    const scoreMatch = data.feedback.match(/Confidence Score.*?(\d+)\s*\/\s*10/i);
    if (scoreMatch) {
      state.confidenceScores.push(parseInt(scoreMatch[1]));
      updateStats();
    }
    state.analysisCount++;
    renderResult('improveResult', data.feedback, 'Answer Analysis');
  } catch (err) {
    hideLoading();
    showToast('Analysis failed.', 'danger');
  }
}

// ─── Interview Plan ────────────────────────────────────────────────────────────
async function generatePlan() {
  const role = document.getElementById('planRole')?.value.trim();
  if (!role) { showToast('Please enter a target role.', 'warning'); return; }

  const payload = {
    role,
    experience:     document.getElementById('planExperience')?.value || '',
    company:        document.getElementById('planCompany')?.value    || '',
    interview_date: document.getElementById('planDate')?.value       || '30 days from now',
    weak_areas:     document.getElementById('planWeakAreas')?.value  || '',
  };

  showLoading('Building your 30-day plan...');
  try {
    const res  = await apiFetch('/api/interview-plan', payload);
    const data = await res.json();
    hideLoading();
    renderResult('planResult', data.plan, '30-Day Interview Plan');
  } catch (err) {
    hideLoading();
    showToast('Plan generation failed.', 'danger');
  }
}

// ─── Resume Analysis ──────────────────────────────────────────────────────────
async function analyseResume() {
  const resume  = document.getElementById('resumeContent')?.value.trim();
  const role    = document.getElementById('resumeRole')?.value.trim();
  const company = document.getElementById('resumeCompany')?.value || '';

  if (!resume) { showToast('Please paste your resume content.', 'warning'); return; }
  if (!role)   { showToast('Please enter the target role.', 'warning'); return; }

  showLoading('Analysing your resume...');
  try {
    const res  = await apiFetch('/api/analyze-resume', { resume, role, company });
    const data = await res.json();
    hideLoading();
    renderResult('resumeResult', data.analysis, 'Resume Analysis');
  } catch (err) {
    hideLoading();
    showToast('Resume analysis failed.', 'danger');
  }
}

// ─── Company Prep Shortcut ────────────────────────────────────────────────────
function selectCompanyForPrep(companyKey) {
  // Set company in questions generator and switch to it
  const sel = document.getElementById('qCompany');
  if (sel) sel.value = companyKey;
  showTab('questions', null);
  // Also update sidebar active item
  document.querySelectorAll('.desktop-sidebar .nav-item').forEach(el => el.classList.remove('active'));
  const items = document.querySelectorAll('.desktop-sidebar .nav-item');
  items.forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes('questions')) {
      el.classList.add('active');
    }
  });
  showToast(`${companyKey.charAt(0).toUpperCase() + companyKey.slice(1)} selected for prep!`, 'success');
}

// ─── Helper: Use question in analyser ────────────────────────────────────────
function useQuestion(question, role) {
  document.getElementById('improveQuestion').value = question;
  document.getElementById('improveRole').value     = role;
  showTab('improve', null);
}

function practiceQuestion(question) {
  document.getElementById('chatInput').value = `Let me practise answering this question: "${question}"`;
  showTab('chat', null);
  sendChatMessage();
}

// ─── Render Result Panel ──────────────────────────────────────────────────────
function renderResult(panelId, text, title) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.innerHTML = `
    <div class="result-content">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h6 class="mb-0 fw-semibold"><i class="bi bi-stars text-primary me-2"></i>${title}</h6>
        <button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyResultText('${panelId}')">
          <i class="bi bi-clipboard me-1"></i>Copy
        </button>
      </div>
      <div class="rendered-content">${renderMarkdown(text)}</div>
    </div>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
async function apiFetch(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function renderMarkdown(text) {
  if (typeof marked === 'undefined') return `<p>${escHtml(text).replace(/\n/g, '<br/>')}</p>`;
  try {
    return marked.parse(text, { breaks: true, gfm: true });
  } catch { return `<p>${escHtml(text)}</p>`; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showLoading(text = 'Processing...') {
  const overlay = document.getElementById('loadingOverlay');
  const txt     = document.getElementById('loadingText');
  if (txt) txt.textContent = text;
  if (overlay) overlay.classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.remove('active');
}

function showToast(message, type = 'info') {
  const toastEl = document.getElementById('appToast');
  const body    = document.getElementById('toastBody');
  if (!toastEl || !body) return;

  body.textContent = message;
  toastEl.className = `toast align-items-center border-0 text-bg-${type}`;
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
}

function copyResultText(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const text = panel.innerText || panel.textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success'));
}

function copyTemplate() {
  const box = document.querySelector('.template-box');
  if (!box) return;
  navigator.clipboard.writeText(box.innerText).then(() => showToast('Template copied!', 'success'));
}

function clearSession() {
  fetch('/api/clear-session', { method: 'POST' });
  clearChat();
  state.questionsCount   = 0;
  state.analysisCount    = 0;
  state.confidenceScores = [];
  loadDashboard();
  showTab('dashboard', null);
  showToast('New session started!', 'primary');
}

function setDefaultPlanDate() {
  const el = document.getElementById('planDate');
  if (!el) return;
  const d = new Date();
  d.setDate(d.getDate() + 30);
  el.value = d.toISOString().split('T')[0];
}

function autoResizeTextareas() {
  document.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', () => autoResizeTextarea(ta));
  });
}

function autoResizeTextarea(ta) {
  if (ta.id === 'chatInput') {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }
}
