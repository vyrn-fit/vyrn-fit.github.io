// Vyrn App - Fully usable PWA
const SUPABASE_URL = 'https://qgbpghtgcgzghpzoehrl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QkkE85SWWUNpSmvAK6R8kg_oB2bHJvQ';

let supabase = null;
let currentUser = null;
let currentScreen = 'welcome';
let workoutTimer = null;
let workoutSeconds = 0;
let challengeTimer = null;
let challengeSeconds = 0;
let challengeRunning = false;

// Local storage fallback when Supabase tables aren't ready
const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('vyrn_' + key)); } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem('vyrn_' + key, JSON.stringify(val));
  }
};

const DEFAULT_CHALLENGE = {
  id: 'local-1',
  title: 'Forge Circuit #1',
  description: 'Timed bodyweight circuit. Complete for time.',
  exercises: [
    { name: 'Air Squats', reps: 40 },
    { name: 'Push-ups', reps: 30 },
    { name: 'Walking Lunges', reps: 40 },
    { name: 'Burpees', reps: 20 },
    { name: 'Mountain Climbers', reps: 50 },
    { name: 'Plank', duration_seconds: 60 }
  ]
};

const QUICK_WORKOUT = {
  title: '12-Min Full Body',
  exercises: [
    { name: 'Jumping Jacks', duration: 40, rest: 20 },
    { name: 'Push-ups', duration: 40, rest: 20 },
    { name: 'Bodyweight Squats', duration: 40, rest: 20 },
    { name: 'Mountain Climbers', duration: 40, rest: 20 },
    { name: 'Plank', duration: 40, rest: 20 },
    { name: 'Lunges', duration: 40, rest: 20 },
    { name: 'Burpees', duration: 40, rest: 20 },
    { name: 'High Knees', duration: 40, rest: 20 },
    { name: 'Glute Bridges', duration: 40, rest: 20 },
    { name: 'Superman Hold', duration: 40, rest: 20 },
    { name: 'Wall Sit', duration: 40, rest: 20 },
    { name: 'Cool Down Stretch', duration: 40, rest: 0 }
  ]
};

async function init() {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      supabase.auth.onAuthStateChange((_e, s) => {
        currentUser = s?.user || null;
        render();
      });
    }
  }
  // Load local profile
  if (!currentUser && store.get('guest')) {
    currentUser = { id: 'guest', email: store.get('guest').email || 'guest@vyrn.app', isGuest: true };
  }
  render();
}

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

function navigate(screen) {
  currentScreen = screen;
  render();
  window.scrollTo(0, 0);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getStats() {
  const workouts = store.get('workouts') || [];
  const entries = store.get('entries') || [];
  const streak = store.get('streak') || 0;
  return { workouts: workouts.length, streak, rank: entries.length ? '#' + (entries.length) : '—' };
}

function render() {
  const app = $('#app');
  if (!app) return;

  if (!currentUser && currentScreen !== 'welcome' && currentScreen !== 'login') {
    currentScreen = 'welcome';
  }

  const screens = {
    welcome: renderWelcome,
    login: renderLogin,
    home: renderHome,
    workout: renderWorkout,
    challenge: renderChallenge,
    challengeRun: renderChallengeRun,
    profile: renderProfile,
    onboarding: renderOnboarding
  };

  app.innerHTML = (screens[currentScreen] || renderWelcome)();
  bindEvents();
}

function renderWelcome() {
  return `
  <div class="screen center">
    <div class="logo-big">VYRN</div>
    <p class="tagline">Show up. Put in the work.</p>
    <p class="muted">Equipment-free training + weekly challenges</p>
    <div class="btn-stack">
      <button class="btn primary" data-go="login">Get Started</button>
      <button class="btn ghost" data-action="guest">Continue as Guest</button>
    </div>
  </div>`;
}

function renderLogin() {
  return `
  <div class="screen center">
    <div class="logo-sm">VYRN</div>
    <h2>Welcome</h2>
    <div class="form">
      <input id="email" type="email" placeholder="Email" autocomplete="email" />
      <input id="password" type="password" placeholder="Password" autocomplete="current-password" />
      <button class="btn primary" data-action="signin">Sign In</button>
      <button class="btn secondary" data-action="signup">Create Account</button>
      <button class="btn ghost" data-go="welcome">← Back</button>
    </div>
    <p id="auth-msg" class="msg"></p>
  </div>`;
}

function renderOnboarding() {
  const profile = store.get('profile') || {};
  return `
  <div class="screen">
    <h2>Quick setup</h2>
    <p class="muted mb">So we can personalize your training</p>
    <label>Your goal</label>
    <div class="chips" id="goal-chips">
      ${['strength','endurance','fat_loss','general'].map(g =>
        `<button class="chip ${profile.goal===g?'active':''}" data-goal="${g}">${g.replace('_',' ')}</button>`
      ).join('')}
    </div>
    <label>Fitness level</label>
    <div class="chips" id="level-chips">
      ${['beginner','intermediate','advanced'].map(l =>
        `<button class="chip ${profile.fitness_level===l?'active':''}" data-level="${l}">${l}</button>`
      ).join('')}
    </div>
    <button class="btn primary mt" data-action="save-onboarding">Continue</button>
  </div>`;
}

function renderHome() {
  const stats = getStats();
  const name = currentUser?.email?.split('@')[0] || 'Athlete';
  const profile = store.get('profile') || {};
  if (!profile.onboarding_complete && !currentUser?.isGuest) {
    // soft prompt only
  }
  return `
  <div class="screen">
    <div class="topbar">
      <div>
        <p class="muted">Ready to Vyrn?</p>
        <h2>${name}</h2>
      </div>
    </div>
    <div class="card">
      <h3>Today's Quick Session</h3>
      <p class="muted">12-min full body · No equipment · Office-friendly</p>
      <button class="btn primary" data-go="workout">Start Workout</button>
    </div>
    <div class="card">
      <h3>Weekly Challenge</h3>
      <p class="muted">${DEFAULT_CHALLENGE.title} · Compete for time</p>
      <button class="btn secondary" data-go="challenge">View Challenge →</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="num">${stats.workouts}</div><div class="lbl">Workouts</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="lbl">Streak</div></div>
      <div class="stat"><div class="num">${stats.rank}</div><div class="lbl">Rank</div></div>
    </div>
    ${renderLegalFooter()}${renderTabBar('home')}
  </div>`;
}

function renderWorkout() {
  return `
  <div class="screen">
    <div class="topbar">
      <button class="back" data-go="home">←</button>
      <h2>Quick Session</h2>
    </div>
    <div class="timer-display" id="w-timer">0:00</div>
    <p class="center muted" id="w-status">Ready when you are</p>
    <div class="exercise-list" id="w-list">
      ${QUICK_WORKOUT.exercises.map((e,i) =>
        `<div class="ex-item" data-i="${i}"><span>${e.name}</span><span class="muted">${e.duration}s</span></div>`
      ).join('')}
    </div>
    <div class="btn-stack sticky">
      <button class="btn primary" id="w-start" data-action="start-workout">Start</button>
      <button class="btn ghost hidden" id="w-done" data-action="finish-workout">Finish & Save</button>
    </div>
  </div>`;
}

function renderChallenge() {
  const entries = store.get('entries') || [];
  const sorted = [...entries].sort((a,b) => a.score_seconds - b.score_seconds).slice(0, 10);
  return `
  <div class="screen">
    <div class="topbar">
      <button class="back" data-go="home">←</button>
      <h2>Weekly Challenge</h2>
    </div>
    <div class="card">
      <h3>${DEFAULT_CHALLENGE.title}</h3>
      <p class="muted mb">${DEFAULT_CHALLENGE.description}</p>
      <div class="exercise-list">
        ${DEFAULT_CHALLENGE.exercises.map(e =>
          `<div class="ex-item"><span>${e.name}</span><span class="muted">${e.reps ? e.reps + ' reps' : e.duration_seconds + 's'}</span></div>`
        ).join('')}
      </div>
      <button class="btn primary mt" data-go="challengeRun">Start Challenge</button>
    </div>
    <h3 class="mt">Leaderboard</h3>
    <div class="card tight">
      ${sorted.length === 0 ? '<p class="muted center">No entries yet. Be the first.</p>' :
        sorted.map((e,i) => `
          <div class="lb-row">
            <span class="rank">#${i+1}</span>
            <span class="name">${e.name || 'Athlete'}</span>
            <span class="time">${formatTime(e.score_seconds)}</span>
          </div>`).join('')}
    </div>
    ${renderLegalFooter()}${renderTabBar('challenge')}
  </div>`;
}

function renderChallengeRun() {
  return `
  <div class="screen center">
    <p class="muted">Challenge in progress</p>
    <div class="timer-display big" id="c-timer">0:00</div>
    <p class="muted mb">Complete all exercises, then stop the clock</p>
    <div class="exercise-list left">
      ${DEFAULT_CHALLENGE.exercises.map(e =>
        `<div class="ex-item"><span>${e.name}</span><span class="muted">${e.reps ? e.reps + ' reps' : e.duration_seconds + 's'}</span></div>`
      ).join('')}
    </div>
    <div class="btn-stack">
      <button class="btn primary" id="c-toggle" data-action="toggle-challenge">Start Timer</button>
      <button class="btn secondary hidden" id="c-finish" data-action="finish-challenge">Submit Time</button>
      <button class="btn ghost" data-go="challenge">Cancel</button>
    </div>
  </div>`;
}

function renderProfile() {
  const stats = getStats();
  return `
  <div class="screen">
    <div class="center mb">
      <div class="avatar">${(currentUser?.email?.[0] || 'V').toUpperCase()}</div>
      <p class="muted">${currentUser?.email || 'Guest'}</p>
    </div>
    <div class="card">
      <h3>Free Plan</h3>
      <p class="muted mb">Upgrade to Pro for $7/month — nutrition + advanced tracking (coming soon)</p>
      <button class="btn secondary" data-action="upgrade">Upgrade to Pro</button>
    </div>
    <div class="stats mt">
      <div class="stat"><div class="num">${stats.workouts}</div><div class="lbl">Workouts</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="lbl">Streak</div></div>
    </div>
    <button class="btn ghost mt" data-action="signout">Sign Out</button>
    ${renderLegalFooter()}${renderTabBar('profile')}
  </div>`;
}


function renderLegalFooter() {
  return `<div class="legal-footer">
    <div>
      <a href="/legal/privacy.html">Privacy</a> ·
      <a href="/legal/terms.html">Terms</a> ·
      <a href="/legal/disclaimer.html">Disclaimer</a>
    </div>
    <div style="margin-top:8px">© 2026 Vyrn · Independent original product</div>
  </div>`;
}

function renderTabBar(active) {
  return `
  <nav class="tabbar">
    <button class="tab ${active==='home'?'active':''}" data-go="home">Home</button>
    <button class="tab ${active==='challenge'?'active':''}" data-go="challenge">Challenge</button>
    <button class="tab ${active==='profile'?'active':''}" data-go="profile">Profile</button>
  </nav>`;
}

function bindEvents() {
  $all('[data-go]').forEach(el => el.onclick = () => navigate(el.dataset.go));
  $all('[data-action]').forEach(el => {
    el.onclick = () => handleAction(el.dataset.action);
  });
  $all('[data-goal]').forEach(el => el.onclick = () => {
    const p = store.get('profile') || {};
    p.goal = el.dataset.goal;
    store.set('profile', p);
    render();
  });
  $all('[data-level]').forEach(el => el.onclick = () => {
    const p = store.get('profile') || {};
    p.fitness_level = el.dataset.level;
    store.set('profile', p);
    render();
  });
}

async function handleAction(action) {
  const msg = $('#auth-msg');
  if (action === 'guest') {
    store.set('guest', { email: 'guest@vyrn.app' });
    currentUser = { id: 'guest', email: 'guest@vyrn.app', isGuest: true };
    navigate('home');
    return;
  }
  if (action === 'signin' || action === 'signup') {
    const email = $('#email')?.value?.trim();
    const password = $('#password')?.value;
    if (!email || !password) { if (msg) msg.textContent = 'Fill in all fields'; return; }
    if (!supabase) {
      // Offline / fallback mode
      store.set('guest', { email });
      currentUser = { id: 'local', email, isGuest: true };
      navigate('home');
      return;
    }
    try {
      if (action === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (msg) msg.textContent = 'Check your email to confirm, or try signing in.';
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        navigate('home');
      }
    } catch (e) {
      if (msg) msg.textContent = e.message || 'Auth error';
    }
    return;
  }
  if (action === 'signout') {
    if (supabase) await supabase.auth.signOut();
    currentUser = null;
    store.set('guest', null);
    navigate('welcome');
    return;
  }
  if (action === 'save-onboarding') {
    const p = store.get('profile') || {};
    p.onboarding_complete = true;
    store.set('profile', p);
    navigate('home');
    return;
  }
  if (action === 'start-workout') {
    workoutSeconds = 0;
    $('#w-status').textContent = 'Go!';
    $('#w-start').classList.add('hidden');
    $('#w-done').classList.remove('hidden');
    workoutTimer = setInterval(() => {
      workoutSeconds++;
      $('#w-timer').textContent = formatTime(workoutSeconds);
    }, 1000);
    return;
  }
  if (action === 'finish-workout') {
    clearInterval(workoutTimer);
    const workouts = store.get('workouts') || [];
    workouts.push({ title: QUICK_WORKOUT.title, duration: workoutSeconds, at: Date.now() });
    store.set('workouts', workouts);
    const streak = (store.get('streak') || 0) + 1;
    store.set('streak', streak);
    alert(`Saved! ${formatTime(workoutSeconds)}`);
    navigate('home');
    return;
  }
  if (action === 'toggle-challenge') {
    if (!challengeRunning) {
      challengeRunning = true;
      challengeSeconds = 0;
      $('#c-toggle').textContent = 'Pause';
      $('#c-finish').classList.remove('hidden');
      challengeTimer = setInterval(() => {
        challengeSeconds++;
        $('#c-timer').textContent = formatTime(challengeSeconds);
      }, 1000);
    } else {
      challengeRunning = false;
      clearInterval(challengeTimer);
      $('#c-toggle').textContent = 'Resume';
    }
    return;
  }
  if (action === 'finish-challenge') {
    clearInterval(challengeTimer);
    challengeRunning = false;
    const entries = store.get('entries') || [];
    const name = currentUser?.email?.split('@')[0] || 'Athlete';
    // Update existing entry for this user or add new
    const filtered = entries.filter(e => e.user_id !== (currentUser?.id || 'guest'));
    filtered.push({
      user_id: currentUser?.id || 'guest',
      name,
      score_seconds: challengeSeconds,
      at: Date.now()
    });
    store.set('entries', filtered);
    alert(`Submitted! Your time: ${formatTime(challengeSeconds)}`);
    navigate('challenge');
    return;
  }
  if (action === 'upgrade') {
    alert('Pro plan ($7/mo) coming soon. Nutrition + advanced tracking.');
  }
}

document.addEventListener('DOMContentLoaded', init);
