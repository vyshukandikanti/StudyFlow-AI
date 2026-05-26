'use strict';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
function getApiKey() { return localStorage.getItem('sf_apikey') || ''; }

/* ════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════ */
let S = {
  user:     { name: '', topic: '', level: 'class10', studyTime: '19:00' },
  learning: { nodes: [], currentNodeIdx: 0 },
  progress: { mastered: [], streak: 0, lastActive: null, lastNotifDate: null },
  quiz:     { questions: [], currentQ: 0, answers: [], node: '' },
  ui:       { currentScreen: 'dashboard' }
};

function save() { localStorage.setItem('sf2', JSON.stringify(S)); }

function load() {
  try {
    const raw = localStorage.getItem('sf2');
    if (!raw) return;
    const p = JSON.parse(raw);
    S.user     = { name:'', topic:'', level:'class10', studyTime:'19:00', ...p.user };
    S.learning = { nodes:[], currentNodeIdx:0, ...p.learning };
    S.progress = { mastered:[], streak:0, lastActive:null, lastNotifDate:null, ...p.progress };
    S.quiz     = { questions:[], currentQ:0, answers:[], node:'', ...p.quiz };
    S.ui       = { currentScreen:'dashboard', ...p.ui };
  } catch(e) {}
}

/* ════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════ */
const $  = id => document.getElementById(id);
const tx = (id, t) => { const e = $(id); if (e) e.textContent = t; };

function show(id) { const e = typeof id === 'string' ? $(id) : id; if (e) e.classList.remove('hidden'); }
function hide(id) { const e = typeof id === 'string' ? $(id) : id; if (e) e.classList.add('hidden'); }

const LEVEL_LABEL = { class7:'Class 7', class10:'Class 10', class12:'Class 12', engineering:'Engineering', curious:'Just Curious' };

function topicIcon(t) {
  t = (t || '').toLowerCase();
  if (/python|javascript|java|c\+\+|program|code|web/.test(t)) return '💻';
  if (/math|calculus|algebra|geometry|trigon/.test(t)) return '📐';
  if (/physics/.test(t)) return '⚡';
  if (/chem/.test(t)) return '🧪';
  if (/bio/.test(t)) return '🧬';
  if (/history|gk|geography/.test(t)) return '🌍';
  if (/english|grammar|lit/.test(t)) return '📖';
  if (/econ|finance/.test(t)) return '📊';
  return '🎯';
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function updateStreak() {
  const today = todayStr();
  if (S.progress.lastActive === today) return;
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  S.progress.streak = (S.progress.lastActive === yest) ? (S.progress.streak || 0) + 1 : 1;
  S.progress.lastActive = today;
  save();
}

function nextBadge(s) {
  if (s < 7)  return `⚡ ${7  - s} days`;
  if (s < 30) return `🏅 ${30 - s} days`;
  if (s < 90) return `👑 ${90 - s} days`;
  return '🏆 Legend';
}

/* ════════════════════════════════════════════════════
   TIME ESTIMATION
════════════════════════════════════════════════════ */
function estimateTopicTime(title, level, nodeIndex, totalNodes) {
  // Base time by difficulty level
  const levelMap = {
    'class7':     { easy: 12, medium: 18, hard: 25 },
    'class10':    { easy: 15, medium: 25, hard: 35 },
    'class12':    { easy: 18, medium: 30, hard: 45 },
    'engineering': { easy: 20, medium: 40, hard: 60 },
    'curious':    { easy: 15, medium: 25, hard: 40 }
  };

  const base = levelMap[level] || levelMap['class10'];

  // Sophisticated complexity detection
  let complexity = 'medium';
  const t = (title || '').toLowerCase();

  // EASY: Intro, basics, fundamentals
  if (/intro|basic|fundamental|simple|overview|definition|what is|get started/.test(t)) {
    complexity = 'easy';
  }
  // HARD: Advanced, OOP, architecture, optimization, analysis, visualization, machine learning, etc.
  else if (/advanced|oop|object-oriented|architecture|optimization|analysis|visualization|machine learning|design pattern|algorithm|data structure/.test(t)) {
    complexity = 'hard';
  }
  // MEDIUM: Everything else
  else {
    complexity = 'medium';
  }

  // Base time for complexity
  let time = base[complexity];

  // Add progressive time based on node position (learning gets deeper)
  time += nodeIndex * 3;

  return Math.min(time, 50); // Cap at 50 mins max
}

function formatCompletionTime(minutesFromNow) {
  const now = new Date();
  const completion = new Date(now.getTime() + minutesFromNow * 60000);
  let h = completion.getHours();
  const m = String(completion.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // Convert to 12-hour format
  return `${h}:${m} ${ampm}`;
}

/* ════════════════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('service-worker.js');
    console.log('SW registered');
    return reg;
  } catch(e) {
    console.warn('SW registration failed (likely file:// — deploy to https for full features):', e.message);
    return null;
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) { console.log('No Notification API'); return false; }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function buildNotificationText() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const streak = S.progress.streak || 0;
  const dayLabel = streak > 0 ? `Day ${streak} 🔥` : 'Start your streak today!';
  const nodes = S.learning.nodes;
  const cur = nodes[S.learning.currentNodeIdx];
  const topic = cur?.title || S.user.topic || 'your topic';
  return {
    title: `${greet}, ${S.user.name}! 📚`,
    body: `${dayLabel} — Today: ${topic}. Tap to start →`
  };
}

async function fireNotificationNow() {
  if (Notification.permission !== 'granted') return;
  const { title, body } = buildNotificationText();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      reg.showNotification(title, {
        body, tag: 'studyflow-daily', icon: 'icon.svg', badge: 'icon.svg',
        vibrate: [200, 100, 200], requireInteraction: false
      });
    } else {
      new Notification(title, { body, icon: 'icon.svg', tag: 'studyflow-daily' });
    }
  } catch(e) {
    try { new Notification(title, { body, icon: 'icon.svg' }); } catch(_) {}
  }
}

let notifCheckTimer = null;
function startNotificationScheduler() {
  if (notifCheckTimer) clearInterval(notifCheckTimer);
  notifCheckTimer = setInterval(checkAndFireDailyNotification, 30000); // every 30s
  checkAndFireDailyNotification(); // also check immediately
}

function checkAndFireDailyNotification() {
  if (Notification.permission !== 'granted') return;
  if (!S.user.studyTime) return;
  const today = todayStr();
  if (S.progress.lastNotifDate === today) return; // already fired today

  const now = new Date();
  const [hh, mm] = S.user.studyTime.split(':').map(Number);
  const scheduled = new Date();
  scheduled.setHours(hh, mm, 0, 0);

  // Fire if it's past the scheduled time today
  if (now >= scheduled) {
    fireNotificationNow();
    S.progress.lastNotifDate = today;
    save();
  }
}

/* ════════════════════════════════════════════════════
   GEMINI API
════════════════════════════════════════════════════ */
async function callGemini(prompt) {
  const key = getApiKey();
  if (!key) throw new Error('No API key set — go to Profile tab and paste your Groq key (gsk_...)');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048
    })
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('Groq error:', res.status, errBody);
    let msg = `API error ${res.status}`;
    try { const j = JSON.parse(errBody); msg = j.error?.message || msg; } catch(e) {}
    throw new Error(msg);
  }
  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || '';
  text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return text;
}

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch(e) {} }
  try { return JSON.parse(text); } catch(e) {}
  return null;
}

/* ════════════════════════════════════════════════════
   SCREEN NAVIGATION
════════════════════════════════════════════════════ */
const ALL_SCREENS = ['dashboard','tree','diagnostic','story','quiz','progress','settings'];

function showScreen(name) {
  ALL_SCREENS.forEach(s => {
    const el = $(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });
  // Smart Continuation: Remember which screen user is on
  S.ui.currentScreen = name;
  save();
}

/* ════════════════════════════════════════════════════
   SETUP FLOW
════════════════════════════════════════════════════ */
let setupStep = 0;

function goToStep(n) {
  for (let i = 0; i <= 3; i++) {
    const step = $(`step-${i}`);
    const dot  = $(`dot-${i}`);
    if (step) step.classList.toggle('hidden', i !== n);
    if (dot) {
      dot.classList.remove('active', 'done');
      if (i < n)      dot.classList.add('done');
      else if (i === n) dot.classList.add('active');
    }
  }
  setupStep = n;
  $('btn-setup-back').style.display = n > 0 ? 'block' : 'none';
  $('btn-setup-next').textContent   = n === 3 ? 'Start Learning →' : 'Continue →';
}

function setupNext() {
  const err = $('setup-error');
  err.textContent = '';
  if (setupStep === 0) {
    const name = $('setup-name').value.trim();
    if (!name) { err.textContent = 'Please enter your name.'; return; }
    S.user.name = name;
    goToStep(1);
  } else if (setupStep === 1) {
    const topic = $('setup-topic').value.trim();
    if (!topic) { err.textContent = 'Please enter a topic to learn.'; return; }
    S.user.topic = topic;
    goToStep(2);
  } else if (setupStep === 2) {
    goToStep(3);
  } else {
    const time = $('setup-time').value;
    if (!time) { err.textContent = 'Please pick a study time.'; return; }
    S.user.studyTime = time;
    save();
    requestNotificationPermission();
    launchApp();
  }
}

function launchApp() {
  hide('screen-setup');
  show('app');
  updateStreak();
  updateDashboard();
  showScreen('dashboard');
  startNotificationScheduler();
}

function initLevelCards(grid) {
  grid.querySelectorAll('.level-card').forEach(card => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.level-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      S.user.level = card.dataset.level;
    });
  });
}

/* ════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════ */
function updateDashboard() {
  tx('greeting-text', `${greeting()}, ${S.user.name} 👋`);
  const streak = S.progress.streak || 0;
  tx('header-streak', `🔥 ${streak}`);
  tx('stat-streak',   `${streak} 🔥`);
  tx('stat-mastered', S.progress.mastered.length);
  tx('stat-badge', nextBadge(streak));

  const nodes  = S.learning.nodes;
  const total  = nodes.length || 1;
  const done   = nodes.filter(n => n.status === 'done').length;
  const pct    = nodes.length ? Math.round((done / total) * 100) : 0;
  tx('stat-progress', `${pct}%`);

  if (S.user.topic) {
    tx('today-topic', S.user.topic);
    if (nodes.length > 0) {
      const cur = nodes[S.learning.currentNodeIdx] || nodes[0];
      const estTime = cur.estTime || 20;
      const completionTime = formatCompletionTime(estTime);
      tx('today-sub', cur.title);
      tx('today-step', `Step ${S.learning.currentNodeIdx + 1} of ${nodes.length}`);
      tx('today-time', `⏱️ ${estTime} mins | Complete by ${completionTime}`);
      $('dash-progress-fill').style.width = pct + '%';
      tx('dash-progress-label', `${done} of ${nodes.length} concepts mastered`);
      $('btn-start-learning').textContent = done > 0 ? '▶ Continue Learning' : '▶ Start Learning';
    } else {
      tx('today-sub',  'Click below to build your learning path');
      tx('today-step', '');
      tx('today-time', '');
      $('dash-progress-fill').style.width = '0%';
      tx('dash-progress-label', 'No path built yet');
      $('btn-start-learning').textContent = '▶ Build Learning Path';
    }
  } else {
    tx('today-topic', '—');
    tx('today-sub', 'Complete setup to start learning');
  }
}

/* ════════════════════════════════════════════════════
   TREE BUILDER
════════════════════════════════════════════════════ */
async function generateTree() {
  const inp   = $('tree-topic-input');
  const topic = inp.value.trim() || S.user.topic;
  if (!topic) { inp.focus(); return; }

  hide('tree-empty'); hide('tree-output'); show('tree-loading');
  $('btn-generate-tree').disabled = true;

  const lvMap = { class7:'a 7th grade student', class10:'a 10th grade student', class12:'a 12th grade student', engineering:'an engineering student', curious:'a curious learner' };
  const lv = lvMap[S.user.level] || 'a student';

  const prompt = `Create an ordered learning path for "${topic}" for ${lv}.
Return ONLY valid JSON (no markdown, no explanation):
{
  "nodes": [
    {"title":"Node Title","desc":"One sentence."},
    {"title":"Node Title","desc":"One sentence."}
  ]
}
Rules: 5-8 nodes, ordered prerequisite basics → main topic → advanced application. Titles 2-5 words.`;

  try {
    const raw  = await callGemini(prompt);
    const data = parseJSON(raw);
    if (!data?.nodes?.length) throw new Error('bad');

    S.learning.nodes = data.nodes.map((n, i) => {
      const estTime = estimateTopicTime(n.title, S.user.level, i, data.nodes.length);
      return {
        id: i, title: n.title || `Step ${i+1}`, desc: n.desc || '',
        status: i === 0 ? 'available' : 'locked',
        estTime: estTime
      };
    });
    S.learning.currentNodeIdx = 0;
    S.user.topic = topic;
    save();

    renderTree();
    updateDashboard();
    hide('tree-loading');
    show('tree-output');
    tx('tree-main-topic', topic.toUpperCase());
  } catch(e) {
    console.error('Tree gen error:', e);
    hide('tree-loading');
    show('tree-empty');
    $('tree-empty').querySelector('.empty-title').textContent = 'Could not generate path';
    $('tree-empty').querySelector('.empty-sub').textContent   = e.message || 'Check your internet and try again.';
  }
  $('btn-generate-tree').disabled = false;
}

function renderTree() {
  const container = $('tree-container');
  container.innerHTML = '';
  const icons  = { done:'✅', current:'▶', available:'📖', locked:'🔒' };
  const badges = { done:'DONE', current:'IN PROGRESS', available:'START', locked:'LOCKED' };

  S.learning.nodes.forEach((node, idx) => {
    const div = document.createElement('div');
    div.className = `tree-node ${node.status}`;
    const estTime = node.estTime || 20;
    const completionTime = formatCompletionTime(estTime);
    div.innerHTML = `
      <div class="node-icon">${icons[node.status] || '📖'}</div>
      <div class="node-info">
        <div class="node-title">${node.title}</div>
        <div class="node-desc">${node.desc}</div>
        <div class="node-time">⏱️ ${estTime} mins | Complete by ${completionTime}</div>
      </div>
      <div class="node-badge ${node.status}">${badges[node.status] || ''}</div>`;
    if (node.status === 'available' || node.status === 'current')
      div.addEventListener('click', () => startNode(idx));
    container.appendChild(div);
  });
}

function startNode(idx) {
  S.learning.currentNodeIdx = idx;
  S.learning.nodes[idx].status = 'current';
  save();
  goStory(S.learning.nodes[idx].title, false);
}

/* ════════════════════════════════════════════════════
   DIAGNOSTIC
════════════════════════════════════════════════════ */
let diagCorrect = false;

async function goDiagnostic(nodeName) {
  showScreen('diagnostic');
  tx('diag-topic', nodeName);
  hide('diag-question-wrap'); hide('btn-diag-continue'); show('diag-loading');
  diagCorrect = false;

  const lvMap = { class7:'7th grade', class10:'10th grade', class12:'12th grade', engineering:'engineering', curious:'general' };
  const lv = lvMap[S.user.level] || '10th grade';

  const prompt = `Create a diagnostic question to test if a ${lv} student already knows "${nodeName}" (topic: ${S.user.topic}).
Return ONLY valid JSON:
{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}
Make it conceptual and clear.`;

  try {
    const raw  = await callGemini(prompt);
    const data = parseJSON(raw);
    if (!data?.question) throw new Error('bad');
    hide('diag-loading');
    renderQuestion('diag', data, correct => {
      diagCorrect = correct;
      show('btn-diag-continue');
      $('btn-diag-continue').textContent = correct ? '✓ I know this — skip →' : 'Got it — Teach me →';
    });
    show('diag-question-wrap');
  } catch(e) {
    hide('diag-loading');
    goStory(S.learning.nodes[S.learning.currentNodeIdx].title, false);
  }
}

/* ════════════════════════════════════════════════════
   STORY
════════════════════════════════════════════════════ */
async function goStory(nodeName, different) {
  showScreen('story');
  tx('story-topic', nodeName);
  const node = S.learning.nodes[S.learning.currentNodeIdx];
  if (node?.estTime) {
    const completionTime = formatCompletionTime(node.estTime);
    tx('story-time', `⏱️ Est time: ${node.estTime} mins | Complete by ${completionTime}`);
  }
  hide('story-content'); show('story-loading');

  const audMap = { class7:'12-year-old', class10:'15-year-old', class12:'17-year-old', engineering:'engineering student', curious:'curious adult' };
  const aud = audMap[S.user.level] || '15-year-old';
  const diff = different ? 'Use a COMPLETELY DIFFERENT story, analogy, and examples.' : '';

  const prompt = `You are a patient, friendly tutor explaining "${nodeName}" (part of learning ${S.user.topic}) to a ${aud}.

${diff}

CRITICAL RULES:
- Explain the concept DEEPLY and THOROUGHLY — don't skip anything
- Use VERY SIMPLE English — no jargon, no difficult words. If you must use a technical term, immediately explain what it means in everyday language
- Assume the student knows NOTHING — start from the absolute basics
- Use real-world analogies (like cooking, sports, video games, daily life things)
- Give MULTIPLE concrete examples — at least 2-3 examples for the concept
- Break the explanation into small steps that build on each other
- After explaining "what" it is, explain "why" it matters and "how" it actually works
- Use short sentences. Easy words. Conversational tone — like you're talking to a friend.
- Length: 400-600 words — long enough to truly teach, short enough to stay focused
- No matter how advanced the concept, make it feel easy and obvious by the end

Write ONLY the explanation text. No JSON, no headings, no bullet points, no formatting — just flowing, easy-to-read paragraphs that teach the concept end-to-end.`;

  try {
    const raw = await callGemini(prompt);
    const storyText = raw.trim() || `Let's learn about ${nodeName}! This is a key concept in ${S.user.topic}.`;
    $('story-text').textContent = storyText;
    S.learning.currentStory = storyText;  // ← save story so quiz can use it
    save();
  } catch(e) {
    const fallback = `Let's learn about ${nodeName}!\n\nThis is a key part of ${S.user.topic}. Read carefully and take your time before the quiz.`;
    $('story-text').textContent = fallback;
    S.learning.currentStory = fallback;
    save();
  }

  // YouTube search links with duration filters
  const lvWord = { class7:'beginners', class10:'beginners', class12:'intermediate', engineering:'in depth', curious:'simply explained' };
  const audience = lvWord[S.user.level] || 'beginners';
  const q = encodeURIComponent(`${nodeName} ${S.user.topic} tutorial ${audience}`);
  // sp= filter codes: EgIYAw = short(<4min), EgIYBQ = medium(4-20min), EgIYAQ = long(>20min)
  const base = `https://www.youtube.com/results?search_query=${q}`;
  const ytMedium = $('yt-medium');
  const ytLong   = $('yt-long');
  if (ytMedium) ytMedium.href = base + '&sp=EgIYBQ%3D%3D';
  if (ytLong)   ytLong.href   = base + '&sp=EgIYAQ%3D%3D';

  hide('story-loading'); show('story-content');
}

/* ════════════════════════════════════════════════════
   QUIZ
════════════════════════════════════════════════════ */
async function goQuiz(nodeName) {
  showScreen('quiz');
  tx('quiz-topic', nodeName);
  const node = S.learning.nodes[S.learning.currentNodeIdx];
  if (node?.estTime) {
    const completionTime = formatCompletionTime(node.estTime);
    tx('quiz-time', `⏱️ Est time: ${node.estTime} mins | Complete by ${completionTime}`);
  }
  S.quiz.node = nodeName;
  S.quiz.currentQ = 0;
  S.quiz.answers  = [];
  hide('quiz-question-wrap'); hide('quiz-result'); show('quiz-loading');
  drawQuizDots();

  const lvMap = { class7:'7th grade', class10:'10th grade', class12:'12th grade', engineering:'engineering', curious:'general' };
  const lv = lvMap[S.user.level] || '10th grade';

  const storyContext = S.learning.currentStory || '';
  const prompt = `A ${lv} student just read this story to learn "${nodeName}" (topic: ${S.user.topic}):

"""
${storyContext}
"""

Create exactly 3 quiz questions that test ONLY the concepts, examples, and analogies explained in the story above. Do NOT ask about things not covered in the story. Each question should directly relate to something the student just read.

Return ONLY valid JSON:
{"questions":[
  {"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."},
  {"question":"...","options":["A","B","C","D"],"correct":1,"explanation":"..."},
  {"question":"...","options":["A","B","C","D"],"correct":2,"explanation":"..."}
]}
Reference the analogies and examples from the story. Make questions a student who actually read the story can answer.`;

  try {
    const raw  = await callGemini(prompt);
    const data = parseJSON(raw);
    if (!data?.questions?.length) throw new Error('bad');
    S.quiz.questions = data.questions.slice(0, 3);
    save();
    hide('quiz-loading'); show('quiz-question-wrap');
    renderQuizQ();
  } catch(e) {
    hide('quiz-loading');
    tx('quiz-topic', 'Could not load quiz — tap Back and try again.');
  }
}

function drawQuizDots() {
  const c = $('quiz-dots');
  c.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    if (S.quiz.answers[i] !== undefined) d.className = `quiz-dot ${S.quiz.answers[i] ? 'correct' : 'wrong'}`;
    else if (i === S.quiz.currentQ)      d.className = 'quiz-dot active';
    else                                  d.className = 'quiz-dot';
    c.appendChild(d);
  }
}

function renderQuizQ() {
  const q = S.quiz.questions[S.quiz.currentQ];
  tx('quiz-meta', `Question ${S.quiz.currentQ + 1} of 3`);
  $('quiz-explanation').classList.add('hidden');
  hide('btn-quiz-next');
  drawQuizDots();
  renderQuestion('quiz', q, correct => {
    S.quiz.answers[S.quiz.currentQ] = correct;
    drawQuizDots();
    show('btn-quiz-next');
    $('btn-quiz-next').textContent = S.quiz.currentQ === 2 ? 'See Results →' : 'Next →';
  });
}

function nextQuizQ() {
  if (S.quiz.currentQ < 2) {
    S.quiz.currentQ++;
    renderQuizQ();
  } else {
    showQuizResult();
  }
}

function showQuizResult() {
  hide('quiz-question-wrap'); show('quiz-result');
  const score = S.quiz.answers.filter(Boolean).length;
  const node  = S.quiz.node;

  tx('result-score', `${score} / 3`);

  if (score === 3) {
    tx('result-emoji', '🎉'); tx('result-title', 'Perfect Score!');
    tx('result-desc', `You've mastered "${node}"! Moving to the next concept.`);
    $('result-score').className   = 'result-score neon-green';
    $('btn-result-action').textContent = 'Next Topic →';
    $('btn-result-action').onclick     = advanceNode;
  } else if (score === 2) {
    tx('result-emoji', '👍'); tx('result-title', 'Well Done!');
    tx('result-desc', `Good job! You got the key ideas. Moving to the next concept.`);
    $('result-score').className   = 'result-score neon-orange';
    $('btn-result-action').textContent = 'Next Topic →';
    $('btn-result-action').onclick     = advanceNode;
  } else {
    tx('result-emoji', '💪'); tx('result-title', 'Keep Going!');
    tx('result-desc', "Let's revisit this with a fresh explanation.");
    $('result-score').className   = 'result-score neon-red';
    $('btn-result-action').textContent = 'Re-read Story →';
    $('btn-result-action').onclick     = () => goStory(node, true);
  }

  const bl = $('result-breakdown');
  bl.innerHTML = '';
  S.quiz.questions.forEach((q, i) => {
    const ok   = S.quiz.answers[i];
    const item = document.createElement('div');
    item.className = 'breakdown-item';
    const short = q.question.length > 58 ? q.question.slice(0, 55) + '…' : q.question;
    item.innerHTML = `<span>${ok ? '✅' : '❌'}</span><span>${short}</span>`;
    bl.appendChild(item);
  });
}

function advanceNode() {
  const idx  = S.learning.currentNodeIdx;
  const node = S.learning.nodes[idx];
  node.status = 'done';

  const actualScore = S.quiz.answers.filter(Boolean).length;
  S.progress.mastered.push({
    topic: node.title,
    parentTopic: S.user.topic,
    date: new Date().toLocaleDateString(),
    score: `${actualScore} / 3`,
    icon: topicIcon(S.user.topic)
  });

  const next = idx + 1;
  if (next < S.learning.nodes.length) {
    S.learning.nodes[next].status = 'available';
    S.learning.currentNodeIdx = next;
    save(); updateDashboard();
    showScreen('tree');
    renderTree();
    show('tree-output'); hide('tree-empty'); hide('tree-loading');
    tx('tree-main-topic', S.user.topic.toUpperCase());
    $('tree-topic-input').value = S.user.topic;
  } else {
    save(); updateDashboard();
    showScreen('dashboard');
    setTimeout(() => alert(`🎉 You completed "${S.user.topic}"! Check your Topics Wall.`), 300);
  }
  updateStreak(); save();
}

/* ════════════════════════════════════════════════════
   SHARED QUESTION RENDERER
════════════════════════════════════════════════════ */
function renderQuestion(prefix, data, onAnswer) {
  tx(`${prefix}-question`, data.question);
  const list = $(`${prefix}-options`);
  list.innerHTML = '';
  data.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className   = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      const ok = i === data.correct;
      list.querySelectorAll('.option-btn').forEach((b, j) => {
        b.disabled = true;
        if (j === data.correct) b.classList.add('correct');
        else if (j === i && !ok) b.classList.add('wrong');
      });
      const exp = $(`${prefix}-explanation`);
      if (exp) { exp.textContent = `💡 ${data.explanation}`; exp.classList.remove('hidden'); }
      onAnswer(ok);
    });
    list.appendChild(btn);
  });
}

/* ════════════════════════════════════════════════════
   PROGRESS WALL
════════════════════════════════════════════════════ */
function renderProgressWall() {
  const wall   = $('progress-wall');
  const empty  = $('progress-empty');
  const list   = S.progress.mastered;
  const nodes  = S.learning.nodes;
  const done   = nodes.filter(n => n.status === 'done').length;
  const pct    = nodes.length ? Math.round((done / nodes.length) * 100) : 0;

  tx('pw-mastered', list.length);
  tx('pw-streak',   `${S.progress.streak || 0} 🔥`);
  tx('pw-pct',      `${pct}%`);

  if (!list.length) { wall.innerHTML = ''; show(empty); return; }
  hide(empty);
  wall.innerHTML = '';
  [...list].reverse().forEach(item => {
    const card = document.createElement('div');
    card.className = 'mastered-card';
    card.innerHTML = `
      <div class="mastered-icon">${item.icon || '🎯'}</div>
      <div class="mastered-info">
        <div class="mastered-topic">${item.topic}</div>
        <div class="mastered-meta">${item.parentTopic} · ${item.date}</div>
      </div>
      <div class="mastered-score neon-green">${item.score}</div>`;
    wall.appendChild(card);
  });
}

/* ════════════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════════════ */
function loadSettings() {
  tx('profile-name',  S.user.name);
  tx('profile-topic', S.user.topic || 'No topic set');
  tx('profile-level', LEVEL_LABEL[S.user.level] || S.user.level);
  tx('profile-avatar', (S.user.name || 'S')[0].toUpperCase());
  $('edit-name').value  = S.user.name;
  $('edit-topic').value = S.user.topic;
  $('edit-level-grid').querySelectorAll('.level-card').forEach(c => {
    c.classList.toggle('active', c.dataset.level === S.user.level);
  });
  const saved = localStorage.getItem('sf_apikey');
  const inp = $('api-key-input');
  if (inp) inp.value = saved || '';
  const st = $('api-key-status');
  if (st) { st.textContent = saved ? '✓ Key saved' : 'No key set — using default'; st.className = 'api-key-status ' + (saved ? 'ok' : ''); }

  // Reminder time
  const tEl = $('reminder-time');
  if (tEl) tEl.value = S.user.studyTime || '19:00';
  const nSt = $('notif-status');
  if (nSt) {
    if (!('Notification' in window)) {
      nSt.textContent = '⚠ Notifications not supported in this browser';
      nSt.className = 'api-key-status err';
    } else if (Notification.permission === 'granted') {
      nSt.textContent = `✓ Notifications enabled · Daily at ${S.user.studyTime}`;
      nSt.className = 'api-key-status ok';
    } else if (Notification.permission === 'denied') {
      nSt.textContent = '⚠ Blocked. Allow in browser site settings.';
      nSt.className = 'api-key-status err';
    } else {
      nSt.textContent = 'Tap "Enable Browser Notifications" above';
      nSt.className = 'api-key-status';
    }
  }
}

async function saveReminderTime() {
  const time = $('reminder-time').value;
  if (!time) return;
  S.user.studyTime = time;
  S.progress.lastNotifDate = null; // reset so today's notif can fire again at new time
  save();
  loadSettings();
  startNotificationScheduler();
}

async function enableNotifications() {
  const nSt = $('notif-status');
  if (!('Notification' in window)) {
    if (nSt) { nSt.textContent = '❌ Browser does not support notifications'; nSt.className = 'api-key-status err'; }
    return;
  }
  const ok = await requestNotificationPermission();
  if (ok) {
    startNotificationScheduler();
    if (nSt) { nSt.textContent = '✓ Permission granted! Click "Send Test" to verify.'; nSt.className = 'api-key-status ok'; }
  } else {
    if (nSt) { nSt.textContent = '❌ Permission denied. Check browser site settings.'; nSt.className = 'api-key-status err'; }
  }
  loadSettings();
}

async function sendTestNotification() {
  const nSt = $('notif-status');
  if (!('Notification' in window)) {
    if (nSt) { nSt.textContent = '❌ Browser does not support notifications'; nSt.className = 'api-key-status err'; }
    return;
  }
  if (Notification.permission !== 'granted') {
    if (nSt) { nSt.textContent = '⚠ Click "Enable Browser Notifications" first'; nSt.className = 'api-key-status err'; }
    return;
  }
  const { title, body } = buildNotificationText();
  let fired = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body, tag: 'studyflow-test', icon: 'icon.svg', badge: 'icon.svg',
        vibrate: [200, 100, 200], requireInteraction: false
      });
      fired = true;
    }
  } catch(e) { console.warn('SW notif failed:', e); }
  if (!fired) {
    try {
      new Notification(title, { body, icon: 'icon.svg', tag: 'studyflow-test' });
      fired = true;
    } catch(e) {
      console.error('Direct notif failed:', e);
      if (nSt) { nSt.textContent = `❌ Failed: ${e.message}. On file:// Chrome blocks notifications — deploy to https.`; nSt.className = 'api-key-status err'; }
      return;
    }
  }
  if (fired && nSt) {
    nSt.textContent = '✓ Test sent! Check top-right of your screen for the notification.';
    nSt.className = 'api-key-status ok';
  }
}

function saveApiKey() {
  const key = $('api-key-input').value.trim();
  const st  = $('api-key-status');
  if (!key) { st.textContent = 'Paste your key first.'; st.className = 'api-key-status err'; return; }
  if (!key.startsWith('gsk_')) { st.textContent = 'Groq key should start with gsk_...'; st.className = 'api-key-status err'; return; }
  localStorage.setItem('sf_apikey', key);
  st.textContent = '✓ Key saved! Ready to use.'; st.className = 'api-key-status ok';
}

function saveProfile() {
  const name  = $('edit-name').value.trim();
  const topic = $('edit-topic').value.trim();
  if (!name || !topic) return;
  S.user.name  = name;
  S.user.topic = topic;
  save();
  hide('edit-form');
  loadSettings();
  updateDashboard();
}

function logout() {
  if (!confirm('Clear all progress and reset? This cannot be undone.')) return;
  localStorage.removeItem('sf2');
  location.reload();
}

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */
function init() {
  load();
  registerServiceWorker();

  if (S.user.name && S.user.topic) {
    hide('screen-setup'); show('app');
    updateStreak(); updateDashboard();
    // Smart Continuation: Resume from last screen
    const lastScreen = S.ui.currentScreen || 'dashboard';
    showScreen(lastScreen);
    startNotificationScheduler();
  } else {
    show('screen-setup'); hide('app');
    goToStep(0);
  }

  /* Setup */
  $('btn-setup-next').addEventListener('click', setupNext);
  $('btn-setup-back').addEventListener('click', () => goToStep(setupStep - 1));
  ['setup-name','setup-topic'].forEach(id => {
    $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') setupNext(); });
  });
  initLevelCards($('step-2'));

  /* Bottom nav */
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      showScreen(s);
      if (s === 'progress') renderProgressWall();
      if (s === 'settings') loadSettings();
      if (s === 'tree') {
        if (S.learning.nodes.length > 0) {
          $('tree-topic-input').value = S.user.topic;
          renderTree(); show('tree-output'); hide('tree-empty'); hide('tree-loading');
          tx('tree-main-topic', S.user.topic.toUpperCase());
        } else {
          hide('tree-output'); show('tree-empty');
          $('tree-empty').querySelector('.empty-title').textContent = 'Enter any topic above';
          $('tree-empty').querySelector('.empty-sub').textContent   = 'AI detects every prerequisite and builds your personalised path';
        }
      }
    });
  });

  /* Dashboard */
  $('btn-start-learning').addEventListener('click', () => {
    if (!S.learning.nodes.length) {
      showScreen('tree');
      if (S.user.topic) $('tree-topic-input').value = S.user.topic;
      return;
    }
    const idx  = S.learning.currentNodeIdx;
    const node = S.learning.nodes[idx];
    if (node && node.status !== 'done') goStory(node.title, false);
    else {
      const first = S.learning.nodes.findIndex(n => n.status === 'available');
      if (first >= 0) startNode(first);
      else showScreen('tree');
    }
  });

  $('btn-explore-topic').addEventListener('click', () => {
    showScreen('tree'); $('tree-topic-input').value = ''; $('tree-topic-input').focus();
  });

  /* Tree */
  $('btn-generate-tree').addEventListener('click', generateTree);
  $('tree-topic-input').addEventListener('keydown', e => { if (e.key === 'Enter') generateTree(); });
  $('btn-start-tree').addEventListener('click', () => {
    const first = S.learning.nodes.findIndex(n => n.status === 'available' || n.status === 'current');
    if (first >= 0) startNode(first);
  });

  /* Diagnostic */
  $('btn-diag-continue').addEventListener('click', () => {
    const node = S.learning.nodes[S.learning.currentNodeIdx];
    if (diagCorrect) advanceNode();
    else goStory(node.title, false);
  });

  /* Story */
  $('btn-go-quiz').addEventListener('click', () => {
    goQuiz(S.learning.nodes[S.learning.currentNodeIdx].title);
  });

  /* Quiz */
  $('btn-quiz-next').addEventListener('click', nextQuizQ);

  /* Settings */
  $('btn-save-key').addEventListener('click', saveApiKey);
  $('api-key-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
  $('btn-save-time')?.addEventListener('click', saveReminderTime);
  $('btn-enable-notif')?.addEventListener('click', enableNotifications);
  $('btn-test-notif')?.addEventListener('click', sendTestNotification);

  $('btn-edit-profile').addEventListener('click', () => {
    $('edit-form').classList.toggle('hidden');
    if (!$('edit-form').classList.contains('hidden')) loadSettings();
  });
  $('btn-save-profile').addEventListener('click', saveProfile);
  $('btn-logout').addEventListener('click', logout);
  $('btn-settings-tree').addEventListener('click', () => showScreen('tree'));
  $('btn-settings-progress').addEventListener('click', () => { renderProgressWall(); showScreen('progress'); });
  initLevelCards($('edit-level-grid'));
}

document.addEventListener('DOMContentLoaded', init);
