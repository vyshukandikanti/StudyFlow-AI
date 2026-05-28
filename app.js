'use strict';

const GROQ_URL = 'https://studyflow-proxy.vyshukandikanti2007.workers.dev';
const GROQ_MODEL = 'llama-3.1-8b-instant';

/* ════════════════════════════════════════════════════
   AUTH SYSTEM
════════════════════════════════════════════════════ */
const Auth = {
  isLoggedIn() {
    return !!localStorage.getItem('sf_user_email');
  },

  getUser() {
    const email = localStorage.getItem('sf_user_email');
    if (!email) return null;
    const users = JSON.parse(localStorage.getItem('sf_users') || '[]');
    return users.find(u => u.email === email);
  },

  signup(name, email, password, grade) {
    email = email.toLowerCase().trim();
    let users = JSON.parse(localStorage.getItem('sf_users') || '[]');
    if (users.some(u => u.email === email)) {
      return { success: false, error: 'Email already registered' };
    }
    users.push({ name, email, password, grade });
    localStorage.setItem('sf_users', JSON.stringify(users));
    localStorage.setItem('sf_user_email', email);
    return { success: true };
  },

  login(email, password) {
    email = email.toLowerCase().trim();
    const users = JSON.parse(localStorage.getItem('sf_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    localStorage.setItem('sf_user_email', email);
    return { success: true };
  },

  logout() {
    localStorage.removeItem('sf_user_email');
  }
};

function showLanding() {
  $('screen-landing').style.cssText = 'display:flex !important';
  $('app').style.cssText = 'display:none !important';
}

function showApp() {
  $('screen-landing').style.cssText = 'display:none !important';
  $('app').style.cssText = 'display:flex !important';
  const user = Auth.getUser();
  if (user) {
    $('sidebar-avatar').textContent = user.name[0].toUpperCase();
    $('sidebar-name').textContent = user.name;
    $('sidebar-grade').textContent = { class7: 'Class 7', class10: 'Class 10', class12: 'Class 12', engineering: 'Engineering', curious: 'Just Curious' }[user.grade] || user.grade;
    S.user.name = user.name;
    S.user.level = user.grade;
  }
}

function showLoginModal() {
  $('modal-login').classList.remove('hidden');
  $('modal-signup').classList.add('hidden');
}

function showSignupModal() {
  $('modal-signup').classList.remove('hidden');
  $('modal-login').classList.add('hidden');
}

function closeModals() {
  $('modal-login').classList.add('hidden');
  $('modal-signup').classList.add('hidden');
}

function setupAuthListeners() {
  // Landing buttons
  $('btn-landing-login').addEventListener('click', showLoginModal);
  $('btn-landing-signup').addEventListener('click', showSignupModal);
  $('btn-hero-signup')?.addEventListener('click', showSignupModal);

  // Login modal
  $('btn-close-login').addEventListener('click', closeModals);
  $('link-to-signup').addEventListener('click', showSignupModal);
  $('btn-login-submit').addEventListener('click', () => {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const error = $('login-error');

    if (!email || !password) {
      error.classList.add('show');
      error.textContent = 'Please fill in all fields';
      return;
    }

    const result = Auth.login(email, password);
    if (!result.success) {
      error.classList.add('show');
      error.textContent = result.error;
      return;
    }

    closeModals();
    load();
    showApp();
    setupAppListeners();
    initAllListeners();
    if (S.user.name && S.user.topic) {
      updateStreak(); updateDashboard();
      const lastScreen = S.ui.currentScreen || 'dashboard';
      showScreen(lastScreen);
      startNotificationScheduler();
    } else {
      showScreen('tree');
      setTimeout(() => $('tree-topic-input')?.focus(), 100);
    }
  });

  // Signup modal
  $('btn-close-signup').addEventListener('click', closeModals);
  $('link-to-login').addEventListener('click', showLoginModal);

  // Grade selection in signup
  document.querySelectorAll('.grade-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.grade-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      $('signup-grade').value = opt.dataset.grade;
    });
  });

  $('btn-signup-submit').addEventListener('click', () => {
    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const password = $('signup-password').value;
    const grade = $('signup-grade').value;
    const error = $('signup-error');

    if (!name || !email || !password || !grade) {
      error.classList.add('show');
      error.textContent = 'Please fill in all fields';
      return;
    }

    if (password.length < 6) {
      error.classList.add('show');
      error.textContent = 'Password must be at least 6 characters';
      return;
    }

    const result = Auth.signup(name, email, password, grade);
    if (!result.success) {
      error.classList.add('show');
      error.textContent = result.error;
      return;
    }

    // Initialize user data
    S.user.name = name;
    S.user.level = grade;
    save();

    closeModals();
    showApp();
    setupAppListeners();
    initAllListeners();
    showScreen('tree');
    setTimeout(() => $('tree-topic-input')?.focus(), 100);
  });
}

function setupAppListeners() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item:not(.logout)').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      document.querySelectorAll('.nav-item:not(.logout)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showScreen(screen);
      if (screen === 'progress')    renderProgressWall();
      if (screen === 'analytics')   renderAnalytics();
      if (screen === 'leaderboard') renderLeaderboard();
      if (screen === 'settings')    loadSettings();
      if (screen === 'tree') {
        if (S.learning.nodes.length > 0) {
          $('tree-topic-input').value = S.user.topic;
          renderTree(); show('tree-output'); hide('tree-empty'); hide('tree-loading');
          tx('tree-main-topic', S.user.topic.toUpperCase());
        } else {
          hide('tree-output'); show('tree-empty');
        }
      }
    });
  });

  // Logout button
  $('btn-logout').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      Auth.logout();
      location.reload();
    }
  });
}

/* ════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════ */
let S = {
  user:     { name: '', topic: '', level: 'class10', studyTime: '19:00' },
  learning: { nodes: [], currentNodeIdx: 0, startTime: null },
  progress: { mastered: [], streak: 0, lastActive: null, lastNotifDate: null, activityLog: [] },
  quiz:     { questions: [], currentQ: 0, answers: [], node: '', difficulty: 'medium' },
  ui:       { currentScreen: 'dashboard', voiceEnabled: false }
};

// Voice Mode (Web Speech API)
let voiceState = {
  speaking: false,
  utterance: null
};

// Per-user storage key — each account gets its own data
function getUserDataKey() {
  const email = (localStorage.getItem('sf_user_email') || 'guest').toLowerCase().trim();
  return `sf2_${email}`;
}

function save() { localStorage.setItem(getUserDataKey(), JSON.stringify(S)); }

function load() {
  try {
    const key = getUserDataKey();
    let raw = localStorage.getItem(key);

    // One-time migration: if no per-user data found, check if old shared sf2 belongs to this user
    if (!raw) {
      const oldRaw = localStorage.getItem('sf2');
      if (oldRaw) {
        const oldParsed = JSON.parse(oldRaw);
        const currentUser = Auth.getUser();
        // Migrate only if the name matches — so other users don't inherit this data
        if (currentUser && oldParsed?.user?.name === currentUser.name) {
          localStorage.setItem(key, oldRaw);
          raw = oldRaw;
        }
      }
    }

    if (!raw) return;
    const p = JSON.parse(raw);
    S.user     = { name:'', topic:'', level:'class10', studyTime:'19:00', ...p.user };
    S.learning = { nodes:[], currentNodeIdx:0, startTime:null, savedTopics:[], ...p.learning };
    S.progress = { mastered:[], streak:0, lastActive:null, lastNotifDate:null, activityLog:[], ...p.progress };
    S.quiz     = { questions:[], currentQ:0, answers:[], node:'', difficulty:'medium', ...p.quiz };
    S.ui       = { currentScreen:'dashboard', ...p.ui };
  } catch(e) {}
}

/* ════════════════════════════════════════════════════
   MULTI-TOPIC MANAGEMENT
════════════════════════════════════════════════════ */

// Park the current active topic into savedTopics (upsert)
function saveCurrentTopicToSaved() {
  if (!S.user.topic || !S.learning.nodes.length) return;
  if (!S.learning.savedTopics) S.learning.savedTopics = [];
  const entry = {
    topic: S.user.topic,
    icon:  topicIcon(S.user.topic),
    nodes: S.learning.nodes,
    currentNodeIdx: S.learning.currentNodeIdx
  };
  const idx = S.learning.savedTopics.findIndex(t => t.topic === S.user.topic);
  if (idx >= 0) S.learning.savedTopics[idx] = entry;
  else S.learning.savedTopics.push(entry);
}

// Make a saved topic the active one
function switchToTopic(topicName) {
  if (topicName === S.user.topic) {
    // Already active — just navigate to the tree screen
    showScreen('tree');
    if (S.learning.nodes.length) {
      renderTree(); show('tree-output'); hide('tree-empty'); hide('tree-loading');
      tx('tree-main-topic', topicName.toUpperCase());
      $('tree-topic-input').value = topicName;
    }
    return;
  }
  const saved = (S.learning.savedTopics || []).find(t => t.topic === topicName);
  if (!saved) return;

  saveCurrentTopicToSaved();                                          // park current
  S.learning.savedTopics = S.learning.savedTopics.filter(t => t.topic !== topicName); // remove incoming
  S.user.topic           = topicName;
  S.learning.nodes       = saved.nodes;
  S.learning.currentNodeIdx = saved.currentNodeIdx;
  S.learning.startTime   = null;
  save(); updateDashboard();
  showMotivation('🔄', `Switched to ${topicName}`, 'Continue from where you left off!', 3000);
}

// Save current topic, clear active state, go to tree screen for a new topic
function addNewTopic() {
  saveCurrentTopicToSaved();
  S.user.topic              = '';
  S.learning.nodes          = [];
  S.learning.currentNodeIdx = 0;
  S.learning.startTime      = null;
  save(); updateDashboard();
  showScreen('tree');
  $('tree-topic-input').value = '';
  hide('tree-output'); show('tree-empty');
  setTimeout(() => $('tree-topic-input')?.focus(), 100);
}

// Delete a topic (isActive=true removes the active one, savedIdx removes a parked one)
function deleteTopic(isActive, savedIdx) {
  const saved = S.learning.savedTopics || [];
  if (isActive) {
    // Promote the first saved topic to active, or clear everything
    if (saved.length > 0) {
      const next = saved[0];
      S.learning.savedTopics = saved.slice(1);
      S.user.topic           = next.topic;
      S.learning.nodes       = next.nodes;
      S.learning.currentNodeIdx = next.currentNodeIdx;
      S.learning.startTime   = null;
    } else {
      S.user.topic              = '';
      S.learning.nodes          = [];
      S.learning.currentNodeIdx = 0;
      S.learning.startTime      = null;
    }
  } else {
    S.learning.savedTopics = saved.filter((_, i) => i !== savedIdx);
  }
  save(); updateDashboard();
}

// Render "My Topics" multi-topic switcher cards on the dashboard
function renderMyTopics() {
  const el = $('my-topics-section');
  if (!el) return;

  const saved     = S.learning.savedTopics || [];
  const hasActive = !!(S.user.topic && S.learning.nodes.length);
  if ((hasActive ? 1 : 0) + saved.length < 2) { el.innerHTML = ''; return; }

  const cards = [];
  if (hasActive) {
    const done = S.learning.nodes.filter(n => n.status === 'done').length;
    const pct  = Math.round((done / S.learning.nodes.length) * 100);
    cards.push({ topic: S.user.topic, icon: topicIcon(S.user.topic), done, total: S.learning.nodes.length, pct, active: true, savedIdx: -1 });
  }
  saved.forEach((t, i) => {
    const done = t.nodes.filter(n => n.status === 'done').length;
    const pct  = t.nodes.length ? Math.round((done / t.nodes.length) * 100) : 0;
    cards.push({ topic: t.topic, icon: t.icon || topicIcon(t.topic), done, total: t.nodes.length, pct, active: false, savedIdx: i });
  });

  el.innerHTML = `
    <div class="neon-divider"></div>
    <div class="section-label">⬡ MY TOPICS</div>
    <div class="my-topics-list">
      ${cards.map(c => `
        <div class="topic-row-card${c.active ? ' active-topic' : ''}">
          <div class="topic-row-icon">${c.icon}</div>
          <div class="topic-row-body">
            <div class="topic-row-name">${escHtml(c.topic)}${c.active ? ' <span class="active-badge">ACTIVE</span>' : ''}</div>
            <div class="topic-row-meta">${c.done} of ${c.total} concepts · ${c.pct}%</div>
            <div class="topic-row-bar"><div class="topic-row-fill" style="width:${c.pct}%"></div></div>
          </div>
          <div class="topic-row-actions">
            <button class="btn-topic-action"
              data-active="${c.active}"
              data-savedidx="${c.savedIdx}"
              data-topic="${escAttr(c.topic)}">
              ${c.active ? '▶ Continue' : '↩ Switch'}
            </button>
            <button class="btn-topic-delete"
              data-active="${c.active}"
              data-savedidx="${c.savedIdx}"
              title="Remove topic">✕</button>
          </div>
        </div>`).join('')}
    </div>`;

  el.querySelectorAll('.btn-topic-action').forEach(btn =>
    btn.addEventListener('click', () => switchToTopic(btn.dataset.topic))
  );
  el.querySelectorAll('.btn-topic-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteTopic(btn.dataset.active === 'true', parseInt(btn.dataset.savedidx)))
  );
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }

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

function logActivityToday() {
  const today = todayStr();
  if (!S.progress.activityLog) S.progress.activityLog = [];

  // Check if today's activity is already logged
  const todayLog = S.progress.activityLog.find(log => log.date === today);
  if (!todayLog) {
    S.progress.activityLog.push({ date: today, active: true });
  }

  // Keep only last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  S.progress.activityLog = S.progress.activityLog.filter(log => log.date >= sevenDaysAgo);

  save();
}

function getActivityStrip() {
  if (!S.progress.activityLog) S.progress.activityLog = [];

  const strip = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const active = S.progress.activityLog.some(log => log.date === date);
    strip.push(active ? '✓' : '─');
  }
  return strip.join(' ');
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

function formatCompletionTimeFromStart(cumulativeMinutes) {
  // Calculate from stored start time + cumulative minutes
  const startTime = S.learning.startTime ? new Date(S.learning.startTime) : new Date();
  const completion = new Date(startTime.getTime() + cumulativeMinutes * 60000);
  return formatTime(completion);
}

function formatTime(dateObj) {
  // Format a Date object as "HH:MM AM/PM"
  let h = dateObj.getHours();
  const m = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/* ════════════════════════════════════════════════════
   VOICE MODE
════════════════════════════════════════════════════ */
function speakStory(text) {
  if (!('speechSynthesis' in window)) {
    alert('🔊 Voice not supported in this browser');
    return;
  }

  if (voiceState.speaking) {
    window.speechSynthesis.pause();
    voiceState.speaking = false;
    updateVoiceButton();
    return;
  }

  if (voiceState.utterance) {
    window.speechSynthesis.resume();
    voiceState.speaking = true;
    updateVoiceButton();
    return;
  }

  voiceState.utterance = new SpeechSynthesisUtterance(text);
  voiceState.utterance.rate = 0.95;
  voiceState.utterance.pitch = 1;
  voiceState.utterance.volume = 1;

  voiceState.utterance.onend = () => {
    voiceState.speaking = false;
    voiceState.utterance = null;
    updateVoiceButton();
  };

  window.speechSynthesis.speak(voiceState.utterance);
  voiceState.speaking = true;
  updateVoiceButton();
}

function stopVoice() {
  window.speechSynthesis.cancel();
  voiceState.speaking = false;
  voiceState.utterance = null;
  updateVoiceButton();
}

/* ════════════════════════════════════════════════════
   SHARING
════════════════════════════════════════════════════ */
function shareTopicWhatsApp(topicTitle, nodeName) {
  const message = `Hey! I'm learning "${nodeName}" as part of "${topicTitle}" on StudyFlow AI. Join me! 📚`;
  const encodedMsg = encodeURIComponent(message);
  const waLink = `https://wa.me/?text=${encodedMsg}`;
  window.open(waLink, '_blank');
}

function shareProgressWall() {
  const done = S.learning.nodes.filter(n => n.status === 'done').length;
  const total = S.learning.nodes.length || 1;
  const pct = S.learning.nodes.length ? Math.round((done / total) * 100) : 0;
  const streak = S.progress.streak || 0;
  const message = `I'm learning on StudyFlow AI! 🚀\nTopic: ${S.user.topic}\n✓ ${done}/${total} concepts mastered\n🔥 Streak: ${streak} days\n📈 Progress: ${pct}%`;
  const encodedMsg = encodeURIComponent(message);
  const waLink = `https://wa.me/?text=${encodedMsg}`;
  window.open(waLink, '_blank');
}

async function downloadProgressWallImage() {
  const element = $('progress-wall');
  if (!element || !element.children.length) {
    alert('Nothing to download yet. Complete some topics first!');
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#080C14',
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `StudyFlow-Progress-${new Date().toISOString().split('T')[0]}.png`;
    link.click();
  } catch (error) {
    alert('📸 Error capturing image. Try again!');
    console.error('Screenshot error:', error);
  }
}

function saveNotes() {
  const idx = S.learning.currentNodeIdx;
  const notesTA = $('story-notes-input');
  if (notesTA && idx < S.learning.nodes.length) {
    S.learning.nodes[idx].notes = notesTA.value;
    save();
  }
}

function loadNotes() {
  const idx = S.learning.currentNodeIdx;
  const notesTA = $('story-notes-input');
  if (notesTA && idx < S.learning.nodes.length) {
    notesTA.value = S.learning.nodes[idx].notes || '';
  }
}

function updateVoiceButton() {
  const btn = $('btn-voice-read');
  if (!btn) return;
  btn.textContent = voiceState.speaking ? '⏸ Pause' : '🔊 Read Aloud';
}

/* ════════════════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('service-worker.js');
    console.log('SW registered');

    // Check for updates every 30 seconds
    setInterval(async () => {
      try {
        await reg.update();
      } catch (e) {
        console.log('Update check failed');
      }
    }, 30000);

    // If a new service worker is waiting, reload the page
    if (reg.waiting) {
      console.log('New version available - reloading...');
      location.reload();
    }

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New version available - reloading...');
          location.reload();
        }
      });
    });

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
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
const ALL_SCREENS = ['dashboard','tree','diagnostic','story','quiz','progress','analytics','leaderboard','settings'];

/* ════════════════════════════════════════════════════
   SPACED REPETITION HELPERS
════════════════════════════════════════════════════ */
function calculateNextReview(score) {
  const days = score === 3 ? 7 : score === 2 ? 3 : 1;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDueTopics() {
  const today = todayStr();
  return (S.progress.mastered || [])
    .map((m, i) => ({ ...m, _idx: i }))
    .filter(m => !m.nextReviewDate || m.nextReviewDate <= today);
}

function startRevision(masteredIdx) {
  const entry = S.progress.mastered[masteredIdx];
  if (!entry) return;
  S.quiz.isRevision  = true;
  S.quiz.revisionIdx = masteredIdx;
  goQuiz(entry.topic);
}

function saveRevision() {
  const score = S.quiz.answers.filter(Boolean).length;
  const idx   = S.quiz.revisionIdx;
  if (idx >= 0 && idx < S.progress.mastered.length) {
    const entry = S.progress.mastered[idx];
    if (!entry.revisions) entry.revisions = [];
    entry.revisions.push({ date: new Date().toLocaleDateString(), score: `${score} / 3` });
    entry.nextReviewDate     = calculateNextReview(score);
    entry.lastRevisionScore  = `${score} / 3`;
  }
  S.quiz.isRevision  = false;
  S.quiz.revisionIdx = -1;
  logActivityToday(); updateStreak(); save();
  showScreen('progress');
  renderProgressWall();
}

function showScreen(name) {
  ALL_SCREENS.forEach(s => {
    const el = $(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  // Update sidebar nav active state
  document.querySelectorAll('.nav-item:not(.logout)').forEach(btn => {
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
  tx('activity-strip', getActivityStrip());

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

      // Find the base time for current topic (= last completed topic's actual time, or session start)
      let baseTime = S.learning.startTime ? new Date(S.learning.startTime) : new Date();
      for (let i = 0; i < S.learning.currentNodeIdx; i++) {
        if (nodes[i].actualCompletionTime) {
          baseTime = new Date(nodes[i].actualCompletionTime);
        } else if (nodes[i].status === 'done') {
          // If marked done but no actual time, estimate it
          baseTime = new Date(baseTime.getTime() + (nodes[i].estTime || 20) * 60000);
        }
      }

      // Calculate completion time for current topic
      let completionTime;
      if (cur.status === 'done' && cur.actualCompletionTime) {
        completionTime = formatTime(new Date(cur.actualCompletionTime));
      } else {
        const estimatedCompletion = new Date(baseTime.getTime() + estTime * 60000);
        completionTime = formatTime(estimatedCompletion);
      }

      // Different display for done vs current/available
      let timeDisplay = '';
      if (cur.status === 'done') {
        // After completion: show ONLY actual completion time
        timeDisplay = `Completed at ${completionTime}`;
      } else {
        // Before completion: show ONLY estimated time
        timeDisplay = `⏱️ ${estTime} mins`;
      }

      tx('today-sub', cur.title);
      tx('today-step', `Step ${S.learning.currentNodeIdx + 1} of ${nodes.length}`);
      tx('today-time', timeDisplay);
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
    tx('today-sub', 'Add a topic below to start learning');
  }

  // Render multi-topic switcher cards
  renderMyTopics();
}

/* ════════════════════════════════════════════════════
   TREE BUILDER
════════════════════════════════════════════════════ */
async function generateTree() {
  const inp   = $('tree-topic-input');
  const topic = inp.value.trim() || S.user.topic;
  if (!topic) { inp.focus(); return; }

  // If building a different topic, park the current one first
  if (topic !== S.user.topic && S.user.topic && S.learning.nodes.length > 0) {
    saveCurrentTopicToSaved();
  }

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

    // Remove any old saved entry with the same name to avoid duplicates
    S.learning.savedTopics = (S.learning.savedTopics || []).filter(t => t.topic !== topic);

    S.learning.nodes = data.nodes.map((n, i) => {
      const estTime = estimateTopicTime(n.title, S.user.level, i, data.nodes.length);
      return {
        id: i, title: n.title || `Step ${i+1}`, desc: n.desc || '',
        status: i === 0 ? 'available' : 'locked',
        estTime: estTime,
        notes: ''
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

  // Start from the session start time
  let baseTime = S.learning.startTime ? new Date(S.learning.startTime) : new Date();

  S.learning.nodes.forEach((node, idx) => {
    const div = document.createElement('div');
    div.className = `tree-node ${node.status}`;
    const estTime = node.estTime || 20;

    // Determine the reference time for this topic's completion
    let completionTime;

    if (node.status === 'done' && node.actualCompletionTime) {
      // This topic was actually completed - use REAL completion time
      completionTime = formatTime(new Date(node.actualCompletionTime));
      // Next topic's base time is this topic's actual completion time
      baseTime = new Date(node.actualCompletionTime);
    } else {
      // This topic hasn't been done yet - calculate estimated completion
      // = baseTime (previous actual completion or session start) + est time
      const estimatedCompletion = new Date(baseTime.getTime() + estTime * 60000);
      completionTime = formatTime(estimatedCompletion);
      // Don't change baseTime for non-done topics (they haven't been completed yet)
    }

    // Different display for DONE vs other statuses
    let timeDisplay = '';
    if (node.status === 'done') {
      // After completion: show ONLY actual completion time
      timeDisplay = `Completed at ${completionTime}`;
    } else {
      // Before completion: show ONLY estimated time
      timeDisplay = `⏱️ ${estTime} mins`;
    }

    div.innerHTML = `
      <div class="node-icon">${icons[node.status] || '📖'}</div>
      <div class="node-info">
        <div class="node-title">${node.title}</div>
        <div class="node-desc">${node.desc}</div>
        <div class="node-time">${timeDisplay}</div>
      </div>
      <div class="node-actions">
        <button class="node-share-btn" data-idx="${idx}" title="Share on WhatsApp">💬</button>
        <div class="node-badge ${node.status}">${badges[node.status] || ''}</div>
      </div>`;
    if (node.status === 'available' || node.status === 'current')
      div.addEventListener('click', () => startNode(idx));

    // Share button
    div.querySelector('.node-share-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      shareTopicWhatsApp(S.user.topic, node.title);
    });

    container.appendChild(div);
  });
}

function startNode(idx) {
  // Show time picker on first topic only
  if (!S.learning.startTime) {
    showStartTimeModal(idx);
  } else {
    proceedToNode(idx);
  }
}

function showStartTimeModal(idx) {
  const modal = $('start-time-modal');
  const input = $('start-time-input');
  const btn = $('btn-confirm-start-time');

  // Set default to current time
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  input.value = `${h}:${m}`;

  // Show modal
  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  // Handle confirm
  btn.onclick = () => {
    const timeStr = input.value;
    if (!timeStr) {
      alert('Please select a time');
      return;
    }

    // Store start time as today's date with selected time
    const [hours, mins] = timeStr.split(':');
    const startTime = new Date();
    startTime.setHours(parseInt(hours), parseInt(mins), 0, 0);

    S.learning.startTime = startTime.toISOString();
    save();

    // Hide modal and proceed
    modal.classList.add('hidden');
    modal.style.display = 'none';
    proceedToNode(idx);
  };
}

function proceedToNode(idx) {
  S.learning.currentNodeIdx = idx;
  S.learning.nodes[idx].status = 'current';
  S.learning.nodes[idx].nodeStartTime = new Date().toISOString(); // track when student started
  save();

  // Motivate before hard topics
  const title = S.learning.nodes[idx].title || '';
  if (/advanced|oop|object.oriented|algorithm|architecture|optimization|analysis|design pattern/i.test(title)) {
    showMotivation('💪', 'Challenging Topic Ahead!', `"${title}" is tough — but you've made it this far. Take your time.`, 5000);
  } else if (S.progress.mastered.length === 0 && idx === 0) {
    showMotivation('🚀', 'Your Journey Starts Now!', 'Every expert was once a beginner. Let\'s go!', 5000);
  }

  goStory(S.learning.nodes[idx].title, false);
}

function showChangeStartTimeModal() {
  const modal = $('start-time-modal');
  const input = $('start-time-input');
  const btn = $('btn-confirm-start-time');

  // If no session started yet, show error
  if (!S.learning.startTime) {
    alert('Start a learning session first by clicking "Start Learning" on a topic.');
    return;
  }

  // Set input to current start time
  const startTime = new Date(S.learning.startTime);
  const h = String(startTime.getHours()).padStart(2, '0');
  const m = String(startTime.getMinutes()).padStart(2, '0');
  input.value = `${h}:${m}`;

  // Show modal
  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  // Handle confirm
  btn.onclick = () => {
    const timeStr = input.value;
    if (!timeStr) {
      alert('Please select a time');
      return;
    }

    // Update start time
    const [hours, mins] = timeStr.split(':');
    const newStartTime = new Date();
    newStartTime.setHours(parseInt(hours), parseInt(mins), 0, 0);

    S.learning.startTime = newStartTime.toISOString();
    save();

    // Hide modal
    modal.classList.add('hidden');
    modal.style.display = 'none';

    // Refresh display
    renderTree();
    updateDashboard();

    alert('✅ Session start time updated! Times have been recalculated.');
  };
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
    // Show ONLY estimated time (no "Complete by")
    tx('story-time', `⏱️ ${node.estTime} mins`);
  }

  // Load any existing notes for this topic
  loadNotes();

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
   QUIZ DIFFICULTY PICKER
════════════════════════════════════════════════════ */
function showDifficultyPicker(nodeName) {
  const modal = $('modal-difficulty');
  modal.classList.remove('hidden');

  modal.querySelectorAll('.diff-btn').forEach(btn => {
    // Highlight previously chosen difficulty
    btn.classList.toggle('selected', btn.dataset.diff === (S.quiz.difficulty || 'medium'));

    btn.onclick = () => {
      S.quiz.difficulty = btn.dataset.diff;
      save();
      modal.classList.add('hidden');
      goQuiz(nodeName);
    };
  });
}

/* ════════════════════════════════════════════════════
   QUIZ
════════════════════════════════════════════════════ */
async function goQuiz(nodeName) {
  showScreen('quiz');
  tx('quiz-topic', nodeName);
  if (S.quiz.isRevision) {
    hide('quiz-time');
  } else {
    const node = S.learning.nodes[S.learning.currentNodeIdx];
    if (node?.estTime) {
      tx('quiz-time', `⏱️ ${node.estTime} mins`);
    }
  }
  S.quiz.node = nodeName;
  S.quiz.currentQ = 0;
  S.quiz.answers  = [];
  hide('quiz-question-wrap'); hide('quiz-result'); show('quiz-loading');
  drawQuizDots();

  // Show difficulty badge + Change button
  const diffBadge = $('quiz-diff-badge');
  if (diffBadge) {
    const diffInfo = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' };
    diffBadge.textContent = diffInfo[S.quiz.difficulty] || '🟡 Medium';
    diffBadge.className = `diff-badge diff-badge-${S.quiz.difficulty || 'medium'}`;
  }
  const changeDiffBtn = $('btn-diff-change');
  if (changeDiffBtn) {
    changeDiffBtn.classList.remove('hidden');
    changeDiffBtn.onclick = () => showDifficultyPicker(S.quiz.node || nodeName);
  }

  const lvMap = { class7:'7th grade', class10:'10th grade', class12:'12th grade', engineering:'engineering', curious:'general' };
  const lv = lvMap[S.user.level] || '10th grade';

  const diffGuide = {
    easy:   'EASY: Ask 3 simple recall questions — definitions and basic facts directly from the story. Any student who read it should answer correctly.',
    medium: 'MEDIUM: Ask 3 questions mixing recall and application — test understanding and ability to use the concept in a simple example.',
    hard:   'HARD: Ask 3 challenging questions — test deep understanding, reasoning about WHY concepts work, or applying knowledge analytically.'
  };
  const diffInstruction = diffGuide[S.quiz.difficulty || 'medium'];

  // Trim story to avoid token limits (keep first 1200 chars)
  const storyContext = (S.learning.currentStory || '').slice(0, 1200);

  const prompt = `Topic: "${nodeName}" (${S.user.topic}) — ${lv} student.

Story summary the student just read:
"""
${storyContext}
"""

${diffInstruction}

Return ONLY this exact JSON (no extra text, no markdown):
{"questions":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."},{"question":"...","options":["A","B","C","D"],"correct":1,"explanation":"..."},{"question":"...","options":["A","B","C","D"],"correct":2,"explanation":"..."}]}`;

  try {
    const raw  = await callGemini(prompt);
    const data = parseJSON(raw);
    if (!data?.questions?.length) throw new Error('bad json');
    S.quiz.questions = data.questions.slice(0, 3);
    save();
    hide('quiz-loading'); show('quiz-question-wrap');
    renderQuizQ();
  } catch(e) {
    hide('quiz-loading');
    // Show proper error UI with Retry and Back buttons
    const errCard = document.createElement('div');
    errCard.className = 'quiz-error-card';
    errCard.innerHTML = `
      <div class="quiz-error-emoji">😕</div>
      <div class="quiz-error-msg">Quiz couldn't load — the AI had trouble generating questions.</div>
      <button class="btn btn-neon full-btn" id="btn-quiz-retry-err">🔄 Try Again</button>
      <button class="btn btn-ghost full-btn" id="btn-quiz-back-story">← Back to Story</button>`;
    const screen = $('screen-quiz');
    // Remove old error card if any
    screen.querySelector('.quiz-error-card')?.remove();
    screen.appendChild(errCard);
    $('btn-quiz-retry-err').addEventListener('click', () => {
      errCard.remove();
      goQuiz(nodeName);
    });
    $('btn-quiz-back-story').addEventListener('click', () => {
      errCard.remove();
      goStory(S.learning.nodes[S.learning.currentNodeIdx]?.title || nodeName, false);
    });
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
  hide('btn-diff-change'); // hide the mid-quiz change button — retry section takes over
  const score = S.quiz.answers.filter(Boolean).length;
  const node  = S.quiz.node;

  // ── REVISION MODE ──────────────────────────────
  if (S.quiz.isRevision) {
    const entry    = S.progress.mastered[S.quiz.revisionIdx];
    const prevScore = parseInt(entry?.score) || 0;
    const improved  = score > prevScore;
    const same      = score === prevScore;
    const nextDays  = score === 3 ? 7 : score === 2 ? 3 : 1;
    tx('result-emoji', score === 3 ? '🎯' : improved ? '📈' : same ? '🔄' : '📉');
    tx('result-title', score === 3 ? 'Perfect Revision!' : improved ? 'Improved!' : same ? 'Same Score' : 'Needs More Work');
    tx('result-score', `${score} / 3`);
    $('result-score').className = `result-score ${score===3?'neon-green':score===2?'neon-blue':'neon-orange'}`;
    tx('result-desc', `Previous: ${prevScore}/3 → Now: ${score}/3 · Next review in ${nextDays} day${nextDays>1?'s':''}`);
    $('btn-result-action').textContent = '✓ Done — Back to Topics';
    $('btn-result-action').onclick = saveRevision;
    const bl = $('result-breakdown'); bl.innerHTML = '';
    S.quiz.questions.forEach((q, i) => {
      const item = document.createElement('div'); item.className = 'breakdown-item';
      item.innerHTML = `<span>${S.quiz.answers[i] ? '✅' : '❌'}</span><span style="flex:1;font-size:12px">${q.question?.slice(0,60)}...</span>`;
      bl.appendChild(item);
    });
    return;
  }

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

  // ── Take a Break button ─────────────────────────
  const resultEl = $('quiz-result');
  resultEl.querySelector('.break-btn-wrap')?.remove();
  const breakWrap = document.createElement('div');
  breakWrap.className = 'break-btn-wrap';
  breakWrap.innerHTML = `<button class="btn btn-break full-btn" id="btn-take-break">☕ Take a Break</button>`;
  resultEl.appendChild(breakWrap);
  $('btn-take-break').addEventListener('click', showBreakModal);

  // ── Try Different Difficulty ────────────────────
  resultEl.querySelector('.diff-retry-section')?.remove();
  const retrySection = document.createElement('div');
  retrySection.className = 'diff-retry-section';
  const cur = S.quiz.difficulty || 'medium';
  retrySection.innerHTML = `
    <div class="diff-retry-label">🎮 Try this topic at a different level:</div>
    <div class="diff-retry-btns">
      <button class="diff-retry-btn ${cur==='easy'?'active-diff':''}" data-diff="easy">🟢 Easy</button>
      <button class="diff-retry-btn ${cur==='medium'?'active-diff':''}" data-diff="medium">🟡 Medium</button>
      <button class="diff-retry-btn ${cur==='hard'?'active-diff':''}" data-diff="hard">🔴 Hard</button>
    </div>`;
  resultEl.appendChild(retrySection);
  retrySection.querySelectorAll('.diff-retry-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.quiz.difficulty = btn.dataset.diff;
      save();
      goQuiz(S.quiz.node);
    });
  });
}

function advanceNode() {
  const idx  = S.learning.currentNodeIdx;
  const node = S.learning.nodes[idx];
  node.status = 'done';

  // Record actual completion time (when quiz was completed)
  node.actualCompletionTime = new Date().toISOString();

  // Log activity for today
  logActivityToday();

  const actualScore = S.quiz.answers.filter(Boolean).length;

  // ── Smart Motivational Toast ─────────────────────
  // Capture these BEFORE mastered.push() so isFirst is correct
  const _isFirstMastery = S.progress.mastered.length === 0;
  const _nodeTitle      = node.title || '';
  const _estTime        = node.estTime || 20;
  const _started        = node.nodeStartTime ? new Date(node.nodeStartTime) : null;

  setTimeout(() => {
    const estTime  = _estTime;
    const elapsed  = _started ? (Date.now() - _started.getTime()) / 60000 : null;
    const isHard   = /advanced|oop|object.oriented|algorithm|architecture|optimization|analysis|design pattern/i.test(_nodeTitle);
    const isFirst  = _isFirstMastery;
    const streak   = S.progress.streak || 0;
    const finishedEarly = elapsed !== null && elapsed < estTime * 0.85;

    if (isFirst) {
      showMotivation('🌟', 'First Concept Mastered!', 'Every journey starts with one step — this is yours!');
    } else if (actualScore === 3 && S.quiz.difficulty === 'hard' && isHard) {
      showMotivation('🏆', 'Incredible!', `Perfect score on a Hard, advanced topic. That's elite-level focus!`);
    } else if (actualScore === 3 && isHard) {
      showMotivation('💪', 'Tough Topic Conquered!', `"${node.title}" is one of the harder concepts — and you nailed it!`);
    } else if (finishedEarly && actualScore === 3) {
      showMotivation('⚡', 'Ahead of Schedule!', `You finished "${node.title}" ${Math.round(estTime - elapsed)} mins early with a perfect score. Outstanding!`);
    } else if (finishedEarly) {
      showMotivation('⚡', 'Faster Than Expected!', `You completed "${node.title}" well before the estimated ${estTime} mins. Keep the pace!`);
    } else if ([3,7,10,14,21,30].includes(streak)) {
      showMotivation('🔥', `${streak}-Day Streak!`, `${streak} days of consistent learning — you're building something great!`);
    } else if (actualScore === 3) {
      showMotivation('🎯', 'Perfect Score!', 'You understood every single concept in this topic. Well done!');
    } else {
      showMotivation('👍', 'Concept Complete!', `"${node.title}" is checked off. Keep going — you're making real progress!`);
    }
  }, 600);

  S.progress.mastered.push({
    topic: node.title,
    parentTopic: S.user.topic,
    date: new Date().toLocaleDateString(),
    score: `${actualScore} / 3`,
    icon: topicIcon(S.user.topic),
    nextReviewDate: calculateNextReview(actualScore),
    revisions: []
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
  submitToLeaderboard(); // push updated score to global leaderboard
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
/* ════════════════════════════════════════════════════
   LEADERBOARD
════════════════════════════════════════════════════ */

// Push current user's score to Cloudflare KV leaderboard
async function submitToLeaderboard() {
  try {
    const user = Auth.getUser();
    if (!user) return;
    const mastered = S.progress.mastered || [];
    const avgScore = mastered.length
      ? Math.round((mastered.reduce((s, m) => s + (parseInt(m.score) || 0), 0) / (mastered.length * 3)) * 100)
      : 0;
    await fetch(`${GROQ_URL}/leaderboard`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        name       : user.name,
        email      : user.email,
        streak     : S.progress.streak     || 0,
        topicsCount: mastered.length,
        avgScore
      })
    });
  } catch(e) { /* silent — offline or worker error */ }
}

// Fetch leaderboard entries from Cloudflare KV
async function fetchLeaderboard() {
  try {
    const res = await fetch(`${GROQ_URL}/leaderboard`);
    if (!res.ok) throw new Error('fetch failed');
    return await res.json();
  } catch(e) { return null; }
}

// Render the leaderboard screen
async function renderLeaderboard() {
  const listEl   = $('leaderboard-list');
  const podiumEl = $('lb-podium');
  if (!listEl) return;

  // Show loading
  listEl.innerHTML   = '<div class="lb-loading"><div class="pulse-dot"></div> Loading rankings…</div>';
  if (podiumEl) podiumEl.innerHTML = '';

  // Submit own score first (fire-and-forget), then fetch
  submitToLeaderboard();
  const entries = await fetchLeaderboard();

  if (!entries) {
    listEl.innerHTML = '<div class="lb-empty">⚠ Could not reach leaderboard. Check your connection.</div>';
    return;
  }
  if (entries.length === 0) {
    listEl.innerHTML = '<div class="lb-empty">🌟 No entries yet — complete a quiz to be the first!</div>';
    return;
  }

  // Figure out current user's emailKey to highlight their row
  const currentUser = Auth.getUser();
  let myKey = '';
  if (currentUser) {
    try { myKey = btoa(currentUser.email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24); }
    catch(e) {}
  }

  // ── Podium (top 3) ───────────────────────────────
  if (podiumEl && entries.length >= 1) {
    const order = entries.length >= 3
      ? [entries[1], entries[0], entries[2]]   // 2nd left, 1st center, 3rd right
      : entries.length === 2 ? [entries[1], entries[0], null]
      : [null, entries[0], null];

    const heights = ['70px', '95px', '55px'];
    const medals  = ['🥈', '🥇', '🥉'];
    const labels  = ['2nd', '1st', '3rd'];

    podiumEl.innerHTML = order.map((e, i) => e ? `
      <div class="lb-podium-slot${e.emailKey === myKey ? ' lb-podium-me' : ''}">
        <div class="lb-podium-name">${escHtml(e.name)}</div>
        <div class="lb-podium-streak">${e.streak}🔥</div>
        <div class="lb-podium-medal">${medals[i]}</div>
        <div class="lb-podium-block" style="height:${heights[i]}">${labels[i]}</div>
      </div>` : '<div class="lb-podium-slot lb-podium-empty"></div>'
    ).join('');
  }

  // ── Ranked rows ──────────────────────────────────
  const medals = ['🥇', '🥈', '🥉'];
  listEl.innerHTML = entries.slice(0, 25).map((e, i) => {
    const isMe  = e.emailKey === myKey;
    const rank  = medals[i] || `#${i + 1}`;
    return `<div class="lb-row${isMe ? ' lb-me' : ''}">
      <div class="lb-col-rank">${rank}</div>
      <div class="lb-col-name">${escHtml(e.name)}${isMe ? ' <span class="lb-you-tag">YOU</span>' : ''}</div>
      <div class="lb-col-streak">${e.streak} 🔥</div>
      <div class="lb-col-topics">${e.topicsCount}</div>
      <div class="lb-col-score">${e.avgScore}%</div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════
   ANALYTICS DASHBOARD
════════════════════════════════════════════════════ */
function renderAnalytics() {
  const mastered = S.progress.mastered || [];
  const nodes    = S.learning.nodes || [];
  const streak   = S.progress.streak || 0;

  // ── Overview cards ──────────────────────────────
  tx('an-total-topics', mastered.length);
  tx('an-streak-val', `${streak} 🔥`);

  // Average quiz score
  if (mastered.length > 0) {
    const total = mastered.reduce((s, m) => s + (parseInt(m.score) || 0), 0);
    const pct   = Math.round((total / (mastered.length * 3)) * 100);
    tx('an-avg-score', `${pct}%`);
  } else {
    tx('an-avg-score', '—');
  }

  // Total study time from done nodes
  const doneNodes  = nodes.filter(n => n.status === 'done');
  const totalMins  = doneNodes.reduce((s, n) => s + (n.estTime || 20), 0);
  const h = Math.floor(totalMins / 60), m = totalMins % 60;
  tx('an-study-time', h > 0 ? `${h}h ${m}m` : `${totalMins}m`);

  // ── 7-Day Activity bars ─────────────────────────
  const barsEl = $('an-activity-bars');
  if (barsEl) {
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = '';
    for (let i = 6; i >= 0; i--) {
      const d       = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const active  = (S.progress.activityLog || []).some(l => l.date === dateStr);
      html += `<div class="an-bar-item">
        <div class="an-bar ${active ? 'active' : ''}"></div>
        <div class="an-bar-day">${dayNames[d.getDay()]}</div>
      </div>`;
    }
    barsEl.innerHTML = html;
  }

  // ── Score distribution ──────────────────────────
  const scoreEl = $('an-score-dist');
  if (scoreEl) {
    if (mastered.length === 0) {
      scoreEl.innerHTML = '<div class="an-empty">Complete some quizzes to see your breakdown</div>';
    } else {
      const counts = { 3:0, 2:0, 1:0, 0:0 };
      mastered.forEach(m => { const s = parseInt(m.score) || 0; counts[s]++; });
      const rows = [
        { label:'🎯 Perfect', score:3, color:'var(--green)' },
        { label:'✓ Good',     score:2, color:'var(--accent)' },
        { label:'⚡ Pass',    score:1, color:'var(--orange)' },
        { label:'✗ Retry',   score:0, color:'var(--red)' }
      ];
      scoreEl.innerHTML = rows.map(r => {
        const cnt = counts[r.score] || 0;
        const pct = Math.round((cnt / mastered.length) * 100);
        return `<div class="an-score-row">
          <div class="an-score-label">${r.label}</div>
          <div class="an-score-bar-wrap">
            <div class="an-score-bar" style="width:${pct}%;background:${r.color}"></div>
          </div>
          <div class="an-score-count">${cnt}</div>
        </div>`;
      }).join('');
    }
  }

  // ── Weak topics (score < 3/3) ───────────────────
  const weakEl      = $('an-weak-topics');
  const weakSection = $('an-weak-section');
  if (weakEl && weakSection) {
    const weak = mastered.filter(m => (parseInt(m.score) || 0) < 3);
    if (weak.length === 0) {
      weakSection.style.display = 'none';
    } else {
      weakSection.style.display = '';
      weakEl.innerHTML = weak.map(m => `
        <div class="an-weak-item">
          <span class="an-weak-icon">${m.icon || '📚'}</span>
          <span class="an-weak-name">${m.topic}</span>
          <span class="an-weak-score neon-red">${m.score}</span>
        </div>`).join('');
    }
  }

  // ── Recent completions timeline ─────────────────
  const tlEl = $('an-timeline');
  if (tlEl) {
    if (mastered.length === 0) {
      tlEl.innerHTML = '<div class="an-empty">No topics completed yet — start learning!</div>';
    } else {
      tlEl.innerHTML = [...mastered].reverse().slice(0, 6).map(m => {
        const s   = parseInt(m.score) || 0;
        const col = s === 3 ? 'var(--green)' : s === 2 ? 'var(--accent)' : 'var(--orange)';
        return `<div class="an-timeline-item">
          <div class="an-tl-dot" style="background:${col}"></div>
          <div class="an-tl-info">
            <div class="an-tl-topic">${m.icon || '📚'} ${m.topic}</div>
            <div class="an-tl-meta">${m.date} · ${m.parentTopic || ''}</div>
          </div>
          <div class="an-tl-score" style="color:${col}">${m.score}</div>
        </div>`;
      }).join('');
    }
  }

  // Wire up export button if present
  const expBtn = $('btn-export-pdf-analytics');
  if (expBtn) { expBtn.onclick = exportProgressPDF; }
}

/* ════════════════════════════════════════════════════
   EXPORT PROGRESS REPORT — PDF
════════════════════════════════════════════════════ */
function exportProgressPDF() {
  // If jsPDF hasn't loaded yet, load it now and retry
  if (typeof window.jspdf === 'undefined') {
    showMotivation('⏳', 'Loading PDF library…', 'Hang on — clicking again in 3 seconds will work!', 3000);
    if (!document.getElementById('jspdf-script')) {
      const s = document.createElement('script');
      s.id  = 'jspdf-script';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => exportProgressPDF();
      document.head.appendChild(s);
    }
    return;
  }

  const { jsPDF } = window.jspdf;
  let doc;
  try { doc = new jsPDF({ unit: 'pt', format: 'a4' }); }
  catch(e) { showMotivation('❌', 'PDF Error', 'Could not start PDF: ' + e.message, 5000); return; }

  const user     = Auth.getUser();
  const mastered = S.progress.mastered || [];
  const nodes    = S.learning.nodes    || [];
  const streak   = S.progress.streak  || 0;
  const actLog   = S.progress.activityLog || [];

  const gradeMap = {
    class7: 'Class 7', class10: 'Class 10', class12: 'Class 12',
    engineering: 'Engineering', curious: 'Just Curious'
  };

  // ── Computed stats ─────────────────────────────────
  const avgPct = mastered.length > 0
    ? Math.round((mastered.reduce((s, m) => s + (parseInt(m.score) || 0), 0) / (mastered.length * 3)) * 100)
    : 0;
  const doneNodes  = nodes.filter(n => n.status === 'done');
  const totalMins  = doneNodes.reduce((s, n) => s + (n.estTime || 20), 0);
  const studyStr   = totalMins >= 60 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins}m`;
  const weak       = mastered.filter(m => (parseInt(m.score) || 0) < 3);
  const pdfDate    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const studentName = user?.name || S.user.name || 'Student';
  const grade       = gradeMap[user?.grade || S.user.level] || 'Student';
  const topic       = S.user.topic || 'Not set';

  // ── Color palette ──────────────────────────────────
  const C = {
    headerBg : [10,  14, 35],
    accent   : [0, 198, 255],
    green    : [0,  180, 100],
    orange   : [210, 110,  0],
    red      : [200,  50,  50],
    purple   : [130,  80, 210],
    white    : [255, 255, 255],
    bodyBg   : [255, 255, 255],
    text     : [20,  20,  45],
    subtext  : [110, 110, 140],
    altRow   : [245, 248, 255],
    divider  : [220, 225, 245],
    cardBg   : [240, 245, 255],
    footerBg : [10,  14, 35],
  };

  const PW = 595, PH = 842, M = 40, CW = PW - M * 2;
  let y = 0;

  // ── Helpers ────────────────────────────────────────
  function rgb(col) { doc.setFillColor(...col); }
  function setTxt(col) { doc.setTextColor(...col); }
  function bold(size)   { doc.setFontSize(size); doc.setFont('helvetica', 'bold'); }
  function normal(size) { doc.setFontSize(size); doc.setFont('helvetica', 'normal'); }
  function italic(size) { doc.setFontSize(size); doc.setFont('helvetica', 'italic'); }

  function newPage() {
    doc.addPage();
    rgb(C.bodyBg); doc.rect(0, 0, PW, PH, 'F');
    drawFooterPlaceholder(); // will be overwritten at end
    y = M;
  }

  function checkBreak(needed = 24) {
    if (y + needed > PH - 45) { newPage(); return true; }
    return false;
  }

  function drawFooterPlaceholder() { /* filled at end */ }

  function sectionTitle(title, color = C.accent) {
    checkBreak(28);
    bold(9.5); setTxt(color);
    doc.text(title, M, y);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.line(M, y + 4, M + CW, y + 4);
    y += 15;
    normal(9);
  }

  // ═══════════════════════════════════════════════════
  // PAGE 1 — START
  // ═══════════════════════════════════════════════════
  rgb(C.bodyBg); doc.rect(0, 0, PW, PH, 'F');

  // ── Header block ────────────────────────────────
  rgb(C.headerBg); doc.rect(0, 0, PW, 88, 'F');

  bold(21); setTxt(C.accent);
  doc.text('StudyFlow AI', M, 34);

  bold(11); setTxt(C.white);
  doc.text('LEARNING PROGRESS REPORT', M, 54);

  normal(8.5); doc.setTextColor(150, 175, 200);
  doc.text(pdfDate,        PW - M, 28, { align: 'right' });
  doc.text('vyshukandikanti.github.io/StudyFlow-AI/', PW - M, 42, { align: 'right' });

  normal(9.5); doc.setTextColor(190, 210, 230);
  doc.text(`${studentName}  ·  ${topic}  ·  ${grade}`, M, 74);

  y = 106;

  // ── Stats cards ──────────────────────────────────
  const stats = [
    { label: 'Topics Mastered', value: mastered.length.toString(), color: C.green  },
    { label: 'Avg Quiz Score',  value: mastered.length ? `${avgPct}%` : '—',       color: C.accent  },
    { label: 'Day Streak',      value: `${streak}`,                                  color: C.orange  },
    { label: 'Study Time',      value: studyStr,                                     color: C.purple  },
  ];
  const cw4 = (CW - 9) / 4;
  stats.forEach((st, i) => {
    const cx = M + i * (cw4 + 3);
    rgb(C.cardBg); doc.roundedRect(cx, y, cw4, 52, 4, 4, 'F');
    doc.setDrawColor(...st.color); doc.setLineWidth(1.8);
    doc.line(cx + 6, y, cx + cw4 - 6, y); // top accent line
    bold(17); setTxt(st.color);
    doc.text(st.value, cx + cw4 / 2, y + 23, { align: 'center' });
    normal(7.5); setTxt(C.subtext);
    doc.text(st.label, cx + cw4 / 2, y + 39, { align: 'center' });
  });
  y += 66;

  // ── Topics Mastered ──────────────────────────────
  sectionTitle(`TOPICS MASTERED  (${mastered.length})`);

  if (mastered.length === 0) {
    italic(9); setTxt(C.subtext);
    doc.text('No topics mastered yet — start learning!', M + 4, y);
    y += 18;
  } else {
    // Column header
    normal(8); setTxt(C.subtext);
    doc.text('#',       M + 4,   y);
    doc.text('TOPIC',   M + 22,  y);
    doc.text('DATE',    M + 330, y);
    doc.text('SCORE',   M + 420, y);
    doc.text('RATING',  M + 470, y);
    y += 9;

    mastered.forEach((m, i) => {
      checkBreak(20);
      if (i % 2 === 0) { rgb(C.altRow); doc.rect(M, y - 11, CW, 19, 'F'); }

      const score = parseInt(m.score) || 0;
      const scoreCol = score === 3 ? C.green : score === 2 ? C.accent : score === 1 ? C.orange : C.red;
      const rating   = score === 3 ? 'PERFECT' : score === 2 ? 'GOOD' : score === 1 ? 'PASS' : 'RETRY';
      const tName    = m.topic.length > 43 ? m.topic.slice(0, 40) + '…' : m.topic;

      normal(8.5); setTxt(C.subtext);
      doc.text(`${i + 1}`, M + 4, y);

      setTxt(C.text);
      doc.text(tName, M + 22, y);

      setTxt(C.subtext); normal(8);
      doc.text(m.date || '—', M + 330, y);

      bold(8.5); setTxt(scoreCol);
      doc.text(m.score || '—', M + 420, y);

      normal(7.5);
      doc.text(rating, M + 470, y);

      y += 19;
    });
  }
  y += 10;

  // ── Needs Revision ───────────────────────────────
  if (weak.length > 0) {
    checkBreak(36);
    sectionTitle('NEEDS REVISION', C.orange);

    weak.forEach(m => {
      checkBreak(20);
      const tName = m.topic.length > 43 ? m.topic.slice(0, 40) + '…' : m.topic;
      normal(9); setTxt(C.text);
      doc.text(`* ${tName}`, M + 4, y);
      bold(8.5); setTxt(C.orange);
      doc.text(`${m.score}`, M + 395, y);
      if (m.nextReviewDate) {
        normal(7.5); setTxt(C.subtext);
        doc.text(`Review: ${m.nextReviewDate}`, M + 430, y);
      }
      y += 19;
    });
    y += 8;
  }

  // ── 30-Day Activity Grid ─────────────────────────
  checkBreak(80);
  sectionTitle('30-DAY ACTIVITY');

  const DOT = 13, GAP = 3;
  let dx = M;
  const labelPoints = [];

  for (let i = 29; i >= 0; i--) {
    const d      = new Date(Date.now() - i * 86400000);
    const ds     = d.toISOString().slice(0, 10);
    const active = actLog.some(l => l.date === ds);
    rgb(active ? C.accent : C.divider);
    doc.roundedRect(dx, y, DOT, DOT, 2, 2, 'F');
    if ((29 - i) % 7 === 0) {
      labelPoints.push({ x: dx + DOT / 2, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    }
    dx += DOT + GAP;
  }
  y += DOT + 8;

  // Date labels
  normal(7); setTxt(C.subtext);
  labelPoints.forEach(lp => doc.text(lp.label, lp.x, y, { align: 'center' }));
  y += 12;

  // Legend
  rgb(C.accent);  doc.roundedRect(M,      y, 9, 9, 1.5, 1.5, 'F');
  rgb(C.divider); doc.roundedRect(M + 72, y, 9, 9, 1.5, 1.5, 'F');
  normal(7.5); setTxt(C.subtext);
  doc.text('Active day',  M + 13, y + 7);
  doc.text('No activity', M + 85, y + 7);
  y += 20;

  // ── Learning Path Progress Bar ───────────────────
  if (nodes.length > 0) {
    checkBreak(55);
    sectionTitle('LEARNING PATH PROGRESS');

    const done  = doneNodes.length;
    const pct   = nodes.length ? Math.round((done / nodes.length) * 100) : 0;
    const total = nodes.length;

    normal(9); setTxt(C.text);
    doc.text(`${topic}: ${done} of ${total} topics complete (${pct}%)`, M, y);
    y += 10;

    // Track bg
    rgb(C.divider); doc.roundedRect(M, y, CW, 12, 3, 3, 'F');
    // Track fill
    if (pct > 0) {
      rgb(C.accent); doc.roundedRect(M, y, Math.max(6, CW * pct / 100), 12, 3, 3, 'F');
    }
    y += 22;

    // Show first few upcoming nodes if any
    const upcoming = nodes.filter(n => n.status !== 'done').slice(0, 4);
    if (upcoming.length > 0) {
      checkBreak(20);
      normal(8); setTxt(C.subtext);
      doc.text('Up next:', M, y); y += 12;
      upcoming.forEach(n => {
        checkBreak(16);
        normal(8.5); setTxt(C.text);
        doc.text(`  - ${n.title}`, M, y);
        setTxt(C.subtext); normal(7.5);
        doc.text(`~${n.estTime || 20} min`, PW - M, y, { align: 'right' });
        y += 15;
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // FOOTER on every page
  // ═══════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    rgb(C.footerBg); doc.rect(0, PH - 28, PW, 28, 'F');
    normal(7.5); setTxt([120, 145, 165]);
    doc.text('Generated by StudyFlow AI', M, PH - 10);
    doc.text(pdfDate, PW / 2, PH - 10, { align: 'center' });
    doc.text(`Page ${p} of ${totalPages}`, PW - M, PH - 10, { align: 'right' });
  }

  // ── Save ──────────────────────────────────────────
  try {
    const safeName = studentName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    doc.save(`StudyFlow-Report-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
    showMotivation('📄', 'PDF Exported!', 'Your progress report has been downloaded.', 4000);
  } catch(e) {
    console.error('PDF save failed:', e);
    showMotivation('❌', 'PDF Failed', 'Could not save PDF: ' + e.message, 5000);
  }
}

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

  // ── Due for Review banner ───────────────────────
  const due = getDueTopics();
  if (due.length > 0) {
    const banner = document.createElement('div');
    banner.className = 'review-banner';
    banner.innerHTML = `
      <div class="review-banner-text">
        🔁 <strong>${due.length} topic${due.length>1?'s':''} due for review today!</strong>
        <span>Revise to strengthen your memory</span>
      </div>`;
    wall.appendChild(banner);
  }

  // Add action buttons at top
  const actionDiv = document.createElement('div');
  actionDiv.className = 'progress-action-section';
  actionDiv.innerHTML = `
    <button class="btn btn-ghost" id="btn-share-wall">💬 Share</button>
    <button class="btn btn-ghost" id="btn-download-wall">📸 Download</button>
    <button class="btn btn-export-pdf" id="btn-export-pdf-wall">📄 PDF Report</button>`;
  wall.appendChild(actionDiv);

  [...list].reverse().forEach((item, revIdx) => {
    const realIdx   = list.length - 1 - revIdx;
    const today     = todayStr();
    const isDue     = !item.nextReviewDate || item.nextReviewDate <= today;
    const revCount  = (item.revisions || []).length;
    const card = document.createElement('div');
    card.className = 'mastered-card';
    card.innerHTML = `
      <div class="mastered-icon">${item.icon || '🎯'}</div>
      <div class="mastered-info">
        <div class="mastered-topic">${item.topic}</div>
        <div class="mastered-meta">${item.parentTopic} · ${item.date}${revCount > 0 ? ` · 🔁 ${revCount} revision${revCount>1?'s':''}` : ''}</div>
        ${isDue ? '<div class="review-due-badge">📅 Review Due</div>' : `<div class="review-next">Next review: ${item.nextReviewDate}</div>`}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="mastered-score neon-green">${item.score}</div>
        <button class="btn-review ${isDue ? 'due' : ''}" data-idx="${realIdx}">🔁 Review</button>
      </div>`;
    wall.appendChild(card);
  });

  // Attach event listeners
  $('btn-share-wall')?.addEventListener('click', shareProgressWall);
  $('btn-download-wall')?.addEventListener('click', downloadProgressWallImage);
  $('btn-export-pdf-wall')?.addEventListener('click', exportProgressPDF);

  // Review buttons
  wall.querySelectorAll('.btn-review').forEach(btn => {
    btn.addEventListener('click', () => startRevision(parseInt(btn.dataset.idx)));
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
    if (nSt) { nSt.textContent = '⚠ Click "Enable Notifications" first, then try again'; nSt.className = 'api-key-status err'; }
    return;
  }

  const { title, body } = buildNotificationText();

  // Always show in-app preview toast (so the user always sees something)
  showMotivation('🔔', title, body, 8000);

  // Also try to fire a real OS notification
  let fired = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body, tag: 'studyflow-test', icon: 'icon.svg', badge: 'icon.svg',
        vibrate: [200, 100, 200], requireInteraction: true  // stays until dismissed
      });
      fired = true;
    }
  } catch(e) { console.warn('SW notif failed:', e); }

  if (!fired) {
    try {
      new Notification(title, { body, icon: 'icon.svg', tag: 'studyflow-test', requireInteraction: true });
      fired = true;
    } catch(e) { console.warn('Direct notif failed:', e); }
  }

  if (nSt) {
    if (fired) {
      nSt.textContent = '✓ Notification sent! If no popup appeared, check: Windows Settings → Notifications → Chrome → Allow';
      nSt.className = 'api-key-status ok';
    } else {
      nSt.textContent = '⚠ In-app preview shown above. OS notification blocked — see Windows Settings → Notifications → Chrome';
      nSt.className = 'api-key-status';
    }
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
   MOTIVATIONAL TOASTS
════════════════════════════════════════════════════ */
let motivationTimer = null;

function showMotivation(emoji, title, msg, duration = 5000) {
  // Remove any existing toast
  document.querySelector('.motivation-toast')?.remove();
  if (motivationTimer) { clearTimeout(motivationTimer); motivationTimer = null; }

  const toast = document.createElement('div');
  toast.className = 'motivation-toast';
  toast.innerHTML = `
    <div class="mot-emoji">${emoji}</div>
    <div class="mot-body">
      <div class="mot-title">${title}</div>
      <div class="mot-msg">${msg}</div>
    </div>
    <button class="mot-close" onclick="this.closest('.motivation-toast').remove()">×</button>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  motivationTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

/* ════════════════════════════════════════════════════
   BREAK TIMER
════════════════════════════════════════════════════ */
let breakInterval = null;
let breakTotal    = 0;
let breakRemain   = 0;

const BREAK_TIPS = [
  '💧 Drink some water',
  '👀 Rest your eyes — look far away',
  '🧘 Take 3 deep breaths',
  '🚶 Stand up and stretch',
  '🌤️ Look outside the window',
  '😊 Smile — you\'re doing great!'
];

function showBreakModal() {
  const modal = $('modal-break');
  modal.classList.remove('hidden');
  show('break-pick-view');
  hide('break-timer-view');
  hide('break-done-view');
  if (breakInterval) { clearInterval(breakInterval); breakInterval = null; }

  modal.querySelectorAll('.break-dur-btn').forEach(btn => {
    btn.onclick = () => startBreak(parseInt(btn.dataset.mins));
  });
  $('btn-skip-break').onclick = finishBreak;
  $('btn-end-break').onclick  = () => modal.classList.add('hidden');
}

function startBreak(mins) {
  breakTotal  = mins * 60;
  breakRemain = breakTotal;
  hide('break-pick-view');
  show('break-timer-view');
  hide('break-done-view');
  updateBreakUI();
  breakInterval = setInterval(() => {
    breakRemain--;
    updateBreakUI();
    if (breakRemain <= 0) {
      clearInterval(breakInterval);
      breakInterval = null;
      finishBreak();
      fireBreakEndNotification();
    }
  }, 1000);
}

function updateBreakUI() {
  const m = Math.floor(breakRemain / 60);
  const s = breakRemain % 60;
  tx('break-timer-display', `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  // Ring progress
  const ring = $('break-ring');
  if (ring) {
    const pct = breakTotal > 0 ? breakRemain / breakTotal : 0;
    ring.setAttribute('stroke-dashoffset', Math.round(314 * (1 - pct)));
  }
  // Rotate tips every 20 seconds
  const tipIdx = Math.floor((breakTotal - breakRemain) / 20) % BREAK_TIPS.length;
  tx('break-tip', BREAK_TIPS[tipIdx]);
}

function finishBreak() {
  if (breakInterval) { clearInterval(breakInterval); breakInterval = null; }
  hide('break-timer-view');
  show('break-done-view');
}

async function fireBreakEndNotification() {
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      reg.showNotification('☕ Break is over!', {
        body: 'Feeling refreshed? Time to get back to learning! 📚',
        icon: 'icon.svg', tag: 'studyflow-break'
      });
    }
  } catch(e) {}
}

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */
function init() {
  load();
  registerServiceWorker();

  // Check if user is logged in
  if (!Auth.isLoggedIn()) {
    showLanding();
    setupAuthListeners();
    return;
  }

  // User is logged in - show app
  showApp();
  setupAppListeners();
  initAllListeners();

  if (S.user.name && S.user.topic) {
    updateStreak(); updateDashboard();
    // Never restore to in-progress screens (quiz/story/diagnostic can't resume after refresh)
    const transient = ['quiz', 'story', 'diagnostic'];
    const lastScreen = transient.includes(S.ui.currentScreen) ? 'dashboard' : (S.ui.currentScreen || 'dashboard');
    showScreen(lastScreen);
    startNotificationScheduler();
  } else {
    showScreen('tree');
    setTimeout(() => $('tree-topic-input')?.focus(), 100);
  }
}

function initAllListeners() {
  /* Dashboard */
  $('btn-start-learning')?.addEventListener('click', () => {
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

  $('btn-explore-topic')?.addEventListener('click', addNewTopic);
  $('btn-lb-refresh')?.addEventListener('click', renderLeaderboard);

  /* Tree */
  $('btn-generate-tree')?.addEventListener('click', generateTree);
  $('tree-topic-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') generateTree(); });
  $('btn-start-tree')?.addEventListener('click', () => {
    const first = S.learning.nodes.findIndex(n => n.status === 'available' || n.status === 'current');
    if (first >= 0) startNode(first);
  });

  /* Diagnostic */
  $('btn-diag-continue')?.addEventListener('click', () => {
    const node = S.learning.nodes[S.learning.currentNodeIdx];
    if (diagCorrect) advanceNode();
    else goStory(node.title, false);
  });

  /* Story */
  $('btn-go-quiz')?.addEventListener('click', () => {
    saveNotes();
    showDifficultyPicker(S.learning.nodes[S.learning.currentNodeIdx].title);
  });
  $('btn-voice-read')?.addEventListener('click', () => {
    const text = $('story-text').textContent;
    speakStory(text);
  });
  $('btn-voice-stop')?.addEventListener('click', stopVoice);
  $('story-notes-input')?.addEventListener('blur', saveNotes);

  /* Quiz */
  $('btn-quiz-next')?.addEventListener('click', nextQuizQ);

  /* Settings */
  $('btn-save-key')?.addEventListener('click', saveApiKey);
  $('api-key-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
  $('btn-toggle-key')?.addEventListener('click', () => {
    const inp = $('api-key-input');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    $('btn-toggle-key').textContent = inp.type === 'password' ? '👁' : '🙈';
  });
  $('btn-save-time')?.addEventListener('click', saveReminderTime);
  $('btn-enable-notif')?.addEventListener('click', enableNotifications);
  $('btn-test-notif')?.addEventListener('click', sendTestNotification);
  $('btn-edit-profile')?.addEventListener('click', () => {
    $('edit-form').classList.toggle('hidden');
    if (!$('edit-form').classList.contains('hidden')) loadSettings();
  });
  $('btn-save-profile')?.addEventListener('click', saveProfile);
  $('btn-change-start-time')?.addEventListener('click', showChangeStartTimeModal);
  initLevelCards($('edit-level-grid'));
}

document.addEventListener('DOMContentLoaded', init);
