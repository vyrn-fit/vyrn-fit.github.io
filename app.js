// Vyrn — Solo-first PWA with auth, voice, SFX, motion
const SUPABASE_URL = 'https://qgbpghtgcgzghpzoehrl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QkkE85SWWUNpSmvAK6R8kg_oB2bHJvQ';

let supabaseClient = null;
let currentUser = null;
let currentScreen = 'welcome';
let activeWorkout = null;
let exerciseIndex = 0;
let phase = 'ready';
let phaseSeconds = 0;
let totalSeconds = 0;
let tickTimer = null;
let isPro = false;
let voiceEnabled = true;
let sfxEnabled = true;
let musicHintDismissed = false;
let audioCtx = null;

const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('vyrn_' + key)); } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem('vyrn_' + key, JSON.stringify(val));
  }
};

// Exercise photos (free stock — Unsplash / Pexels)
function photoKey(name) {
  const n = (name || '').toLowerCase();
  // Workout titles first
  if (/office|desk|posture|afternoon energy/.test(n)) return 'office';
  if (/playground|park power/.test(n)) return 'park';
  if (/full body|morning|wake|hotel|travel|micro/.test(n)) return 'home';
  if (/core focus|core/.test(n)) return 'core';
  if (/mobility|stretch|yoga/.test(n)) return 'stretch';
  if (/hiit|express|legs|upper|strength/.test(n)) return 'strength';
  // Exercise names
  if (/chair|seated|wall sit|neck|chin|thoracic|shoulder blade/.test(n)) return 'office';
  if (/squat|sumo|pulse/.test(n)) return 'squat';
  if (/push|dip|pike|diamond|incline/.test(n)) return 'pushup';
  if (/plank|hollow|dead bug|bird|shoulder tap/.test(n)) return 'plank';
  if (/lunge|step-up|step up/.test(n)) return 'lunge';
  if (/jog|run|march|high knee|walk|sprint|perimeter/.test(n)) return 'run';
  if (/open|roll|fold|circle|breath|hamstring|ankle|hip|cool|toe reach|arm circle|side bend/.test(n)) return 'stretch';
  if (/bridge|superman|tabletop|glute/.test(n)) return 'core';
  if (/jump|burpee|jack|climber|broad/.test(n)) return 'jump';
  if (/bench|hang|bar/.test(n)) return 'park';
  return 'default';
}
function photoUrl(name) {
  return '/assets/exercises/' + photoKey(name) + '.jpg?v=15';
}
function iconFor(name) {
  return `<img class="photo-thumb" src="${photoUrl(name)}" alt="" loading="lazy" />`;
}
function iconSvg(name, sizeClass) {
  // compatibility: large photo for stage
  if (sizeClass && sizeClass.includes('lg')) {
    return `<img class="photo-stage" src="${photoUrl(name)}" alt="" />`;
  }
  return iconFor(name);
}

const WORKOUTS = {
  office_10: {
    id: 'office_10', title: 'Office Reset', durationLabel: '10 min', place: 'Office', free: true,
    description: 'Quiet moves between meetings. No jumping.',
    exercises: [
      { name: 'Desk chair sit-to-stand', duration: 40, rest: 15 },
      { name: 'Wall push-ups', duration: 40, rest: 15 },
      { name: 'Standing marches', duration: 40, rest: 15 },
      { name: 'Calf raises', duration: 40, rest: 15 },
      { name: 'Seated torso twists', duration: 40, rest: 15 },
      { name: 'Standing hip circles', duration: 40, rest: 15 },
      { name: 'Wall sit', duration: 40, rest: 15 },
      { name: 'Neck & shoulder rolls', duration: 40, rest: 0 }
    ]
  },
  office_posture: {
    id: 'office_posture', title: 'Desk Posture Fix', durationLabel: '7 min', place: 'Office', free: true,
    description: 'Undo hunching. Quiet, chair-friendly.',
    exercises: [
      { name: 'Seated cat-cow', duration: 40, rest: 10 },
      { name: 'Chin tucks', duration: 30, rest: 10 },
      { name: 'Seated thoracic openers', duration: 40, rest: 10 },
      { name: 'Standing chest opener', duration: 30, rest: 10 },
      { name: 'Hip flexor stretch L', duration: 30, rest: 5 },
      { name: 'Hip flexor stretch R', duration: 30, rest: 10 },
      { name: 'Shoulder blade squeezes', duration: 40, rest: 10 },
      { name: 'Slow neck rolls', duration: 40, rest: 0 }
    ]
  },
  office_energy: {
    id: 'office_energy', title: 'Afternoon Energy', durationLabel: '8 min', place: 'Office', free: false,
    description: 'Wake up without sweating through your shirt.',
    exercises: [
      { name: 'Standing marches', duration: 40, rest: 15 },
      { name: 'Bodyweight squats', duration: 40, rest: 15 },
      { name: 'Wall push-ups', duration: 40, rest: 15 },
      { name: 'Calf raises', duration: 40, rest: 15 },
      { name: 'Standing side bends', duration: 40, rest: 15 },
      { name: 'Arm circles', duration: 30, rest: 10 },
      { name: 'Wall sit', duration: 40, rest: 0 }
    ]
  },
  home_12: {
    id: 'home_12', title: 'Home Full Body', durationLabel: '12 min', place: 'Home', free: true,
    description: 'Classic bodyweight circuit. Living room friendly.',
    exercises: [
      { name: 'Jumping jacks (or step-jacks)', duration: 40, rest: 20 },
      { name: 'Push-ups (knee OK)', duration: 40, rest: 20 },
      { name: 'Bodyweight squats', duration: 40, rest: 20 },
      { name: 'Mountain climbers', duration: 40, rest: 20 },
      { name: 'Glute bridges', duration: 40, rest: 20 },
      { name: 'Plank', duration: 40, rest: 20 },
      { name: 'Reverse lunges', duration: 40, rest: 20 },
      { name: 'Superman holds', duration: 40, rest: 20 },
      { name: 'High knees (or marches)', duration: 40, rest: 20 },
      { name: 'Cool-down stretch', duration: 40, rest: 0 }
    ]
  },
  home_core: {
    id: 'home_core', title: 'Core Focus', durationLabel: '8 min', place: 'Home', free: true,
    description: 'Short core session. Mat optional.',
    exercises: [
      { name: 'Dead bugs', duration: 40, rest: 15 },
      { name: 'Glute bridge march', duration: 40, rest: 15 },
      { name: 'Side plank (left)', duration: 30, rest: 10 },
      { name: 'Side plank (right)', duration: 30, rest: 15 },
      { name: 'Bird dog', duration: 40, rest: 15 },
      { name: 'Hollow hold (or tuck)', duration: 30, rest: 15 },
      { name: 'Slow mountain climbers', duration: 40, rest: 0 }
    ]
  },
  home_am: {
    id: 'home_am', title: 'Morning Wake-Up', durationLabel: '9 min', place: 'Home', free: true,
    description: 'Gentle-to-strong start. No equipment.',
    exercises: [
      { name: 'March in place', duration: 40, rest: 15 },
      { name: 'Arm circles', duration: 30, rest: 10 },
      { name: 'Bodyweight squats', duration: 40, rest: 15 },
      { name: 'Incline or knee push-ups', duration: 40, rest: 15 },
      { name: 'Glute bridges', duration: 40, rest: 15 },
      { name: 'Standing toe reaches', duration: 30, rest: 10 },
      { name: 'Plank', duration: 30, rest: 15 },
      { name: 'Easy stretch flow', duration: 45, rest: 0 }
    ]
  },
  home_hiit: {
    id: 'home_hiit', title: 'Home HIIT Blast', durationLabel: '14 min', place: 'Home', free: false,
    description: 'Higher intensity. Scale jumps to steps anytime.',
    exercises: [
      { name: 'Jumping jacks', duration: 40, rest: 20 },
      { name: 'Squat pulses', duration: 40, rest: 20 },
      { name: 'Push-ups', duration: 40, rest: 20 },
      { name: 'High knees', duration: 40, rest: 20 },
      { name: 'Reverse lunges', duration: 40, rest: 20 },
      { name: 'Mountain climbers', duration: 40, rest: 20 },
      { name: 'Burpees', duration: 35, rest: 25 },
      { name: 'Plank shoulder taps', duration: 40, rest: 20 },
      { name: 'Jump squats (or squats)', duration: 40, rest: 20 },
      { name: 'Cool-down walk in place', duration: 45, rest: 0 }
    ]
  },
  home_legs: {
    id: 'home_legs', title: 'Legs & Glutes', durationLabel: '10 min', place: 'Home', free: false,
    description: 'Lower body strength without weights.',
    exercises: [
      { name: 'Bodyweight squats', duration: 45, rest: 20 },
      { name: 'Reverse lunges', duration: 45, rest: 20 },
      { name: 'Glute bridges', duration: 45, rest: 20 },
      { name: 'Wall sit', duration: 45, rest: 20 },
      { name: 'Single-leg glute bridge L', duration: 30, rest: 10 },
      { name: 'Single-leg glute bridge R', duration: 30, rest: 20 },
      { name: 'Sumo squats', duration: 45, rest: 20 },
      { name: 'Calf raises', duration: 40, rest: 0 }
    ]
  },
  home_upper: {
    id: 'home_upper', title: 'Upper Body Pump', durationLabel: '11 min', place: 'Home', free: false,
    description: 'Push, pull, and hold — floor and wall only.',
    exercises: [
      { name: 'Push-ups', duration: 40, rest: 20 },
      { name: 'Pike push-ups (or wall)', duration: 35, rest: 20 },
      { name: 'Superman holds', duration: 40, rest: 15 },
      { name: 'Diamond or narrow push-ups', duration: 35, rest: 20 },
      { name: 'Plank', duration: 40, rest: 15 },
      { name: 'Reverse tabletop holds', duration: 30, rest: 15 },
      { name: 'Shoulder taps in plank', duration: 40, rest: 20 },
      { name: 'Wall push-ups finisher', duration: 40, rest: 0 }
    ]
  },
  home_mobility: {
    id: 'home_mobility', title: 'Mobility Flow', durationLabel: '10 min', place: 'Home', free: true,
    description: 'Move better. Great on rest days or after sitting.',
    exercises: [
      { name: 'World greatest stretch flow', duration: 45, rest: 15 },
      { name: 'Hip circles', duration: 40, rest: 10 },
      { name: 'Deep squat hold', duration: 40, rest: 15 },
      { name: 'Thoracic rotations', duration: 40, rest: 10 },
      { name: 'Hamstring fold', duration: 40, rest: 10 },
      { name: 'Shoulder CARs slow', duration: 40, rest: 10 },
      { name: 'Ankle rocks', duration: 30, rest: 10 },
      { name: 'Easy breathing stretch', duration: 40, rest: 0 }
    ]
  },
  playground_15: {
    id: 'playground_15', title: 'Playground Circuit', durationLabel: '15 min', place: 'Playground', free: true,
    description: 'Bars, benches, open space. Optional pull-up bar.',
    exercises: [
      { name: 'Park-bench step-ups', duration: 45, rest: 20 },
      { name: 'Incline push-ups (bench)', duration: 45, rest: 20 },
      { name: 'Walking lunges', duration: 45, rest: 20 },
      { name: 'Bench dips', duration: 45, rest: 20 },
      { name: 'Squat jumps (or squats)', duration: 45, rest: 20 },
      { name: 'Dead hangs or scap pulls', duration: 30, rest: 25 },
      { name: 'Plank on grass', duration: 45, rest: 20 },
      { name: 'Burpees', duration: 40, rest: 25 },
      { name: 'Easy jog / walk lap', duration: 60, rest: 0 }
    ]
  },
  playground_sprint: {
    id: 'playground_sprint', title: 'Park Power', durationLabel: '12 min', place: 'Playground', free: false,
    description: 'Open space power. Scale intensity to how you feel.',
    exercises: [
      { name: 'Easy jog warm-up', duration: 60, rest: 20 },
      { name: 'Walking lunges', duration: 45, rest: 20 },
      { name: 'Bench step-ups', duration: 45, rest: 20 },
      { name: 'Incline push-ups', duration: 40, rest: 20 },
      { name: 'Broad jumps (or long steps)', duration: 30, rest: 25 },
      { name: 'Bench dips', duration: 40, rest: 20 },
      { name: 'Sprint or fast walk intervals', duration: 50, rest: 30 },
      { name: 'Plank', duration: 40, rest: 15 },
      { name: 'Cool-down walk', duration: 60, rest: 0 }
    ]
  },
  playground_family: {
    id: 'playground_family', title: 'Playground Easy', durationLabel: '10 min', place: 'Playground', free: true,
    description: 'Light outdoor session. Good with kids nearby.',
    exercises: [
      { name: 'Walk the perimeter', duration: 60, rest: 15 },
      { name: 'Bench sit-to-stand', duration: 40, rest: 15 },
      { name: 'Incline push-ups', duration: 35, rest: 20 },
      { name: 'Standing marches', duration: 40, rest: 15 },
      { name: 'Calf raises on curb', duration: 40, rest: 15 },
      { name: 'Gentle side lunges', duration: 40, rest: 15 },
      { name: 'Easy stretch on grass', duration: 45, rest: 0 }
    ]
  },
  express_6: {
    id: 'express_6', title: 'Express 6', durationLabel: '6 min', place: 'Anywhere', free: false,
    description: 'Maximum density when you only have minutes.',
    exercises: [
      { name: 'Squats', duration: 40, rest: 10 },
      { name: 'Push-ups', duration: 40, rest: 10 },
      { name: 'Lunges', duration: 40, rest: 10 },
      { name: 'Plank', duration: 40, rest: 10 },
      { name: 'Burpees', duration: 40, rest: 10 },
      { name: 'Mountain climbers', duration: 40, rest: 0 }
    ]
  },
  express_4: {
    id: 'express_4', title: 'Micro 4', durationLabel: '4 min', place: 'Anywhere', free: true,
    description: 'Tiny session beats no session.',
    exercises: [
      { name: 'Squats', duration: 40, rest: 15 },
      { name: 'Push-ups or wall push-ups', duration: 40, rest: 15 },
      { name: 'Plank', duration: 30, rest: 15 },
      { name: 'March or jog in place', duration: 40, rest: 0 }
    ]
  },
  hotel_10: {
    id: 'hotel_10', title: 'Travel / Hotel', durationLabel: '10 min', place: 'Anywhere', free: true,
    description: 'Small room friendly. Quiet enough for hotels.',
    exercises: [
      { name: 'Bodyweight squats', duration: 40, rest: 15 },
      { name: 'Incline push-ups (desk/bed)', duration: 40, rest: 15 },
      { name: 'Glute bridges', duration: 40, rest: 15 },
      { name: 'Reverse lunges', duration: 40, rest: 15 },
      { name: 'Plank', duration: 35, rest: 15 },
      { name: 'Superman holds', duration: 35, rest: 15 },
      { name: 'Calf raises', duration: 35, rest: 10 },
      { name: 'Stretch & breathe', duration: 40, rest: 0 }
    ]
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

// —— Audio ——
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}

function beep(freq = 880, dur = 0.08, type = 'sine', gain = 0.08) {
  if (!sfxEnabled) return;
  ensureAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}

function sfxStart() { beep(660, 0.1); setTimeout(() => beep(880, 0.12), 90); }
function sfxRest() { beep(440, 0.15, 'triangle', 0.06); }
function sfxDone() { beep(523, 0.1); setTimeout(() => beep(659, 0.1), 100); setTimeout(() => beep(784, 0.2), 200); }
function sfxTick() { beep(1200, 0.04, 'square', 0.04); }

function speakForTts(text) {
  // Normalize so Speech Synthesis does not spell acronyms/hyphens oddly
  let s = String(text || '');
  const replacements = [
    [/push-?ups?/gi, 'push ups'],
    [/sit-?ups?/gi, 'sit ups'],
    [/pull-?ups?/gi, 'pull ups'],
    [/chin-?ups?/gi, 'chin ups'],
    [/jumping jacks?/gi, 'jumping jacks'],
    [/high knees?/gi, 'high knees'],
    [/mountain climbers?/gi, 'mountain climbers'],
    [/glute bridges?/gi, 'glute bridges'],
    [/dead bugs?/gi, 'dead bugs'],
    [/bird dogs?/gi, 'bird dogs'],
    [/wall sits?/gi, 'wall sits'],
    [/calf raises?/gi, 'calf raises'],
    [/hip circles?/gi, 'hip circles'],
    [/step-?ups?/gi, 'step ups'],
    [/cool-?down/gi, 'cool down'],
    [/wake-?up/gi, 'wake up'],
    [/HIIT/g, 'hit'],
    [/\bL\b/g, 'left'],
    [/\bR\b/g, 'right'],
    [/\(knee OK\)/gi, 'knees okay'],
    [/\(or [^)]+\)/gi, ''],  // drop parenthetical alternatives for cleaner speech
    [/-/g, ' '],
    [/\s+/g, ' ']
  ];
  for (const [re, rep] of replacements) s = s.replace(re, rep);
  return s.trim();
}

function speak(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakForTts(text));
    u.rate = 1.0;
    u.pitch = 1;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}


function renderMusicBar(compact) {
  const spotifyUrl = 'https://open.spotify.com/search/workout%20focus';
  const appleUrl = 'https://music.apple.com/search?term=workout';
  if (compact) {
    return `<div class="music-bar compact">
      <span class="music-label">Music</span>
      <a class="music-chip" href="${spotifyUrl}" target="_blank" rel="noopener">Spotify</a>
      <a class="music-chip" href="${appleUrl}" target="_blank" rel="noopener">Apple Music</a>
    </div>`;
  }
  return `<div class="music-card">
    <h3>Soundtrack</h3>
    <p class="muted mb">Play your own music in the background — works great with headphones.</p>
    <div class="music-actions">
      <a class="btn secondary music-link" href="${spotifyUrl}" target="_blank" rel="noopener">Open Spotify</a>
      <a class="btn secondary music-link" href="${appleUrl}" target="_blank" rel="noopener">Open Apple Music</a>
    </div>
    <p class="music-tip muted">Tip: start a playlist, return here, then hit Begin. Voice cues stay on top.</p>
  </div>`;
}


// —— Helpers ——
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function getHistory() { return store.get('history') || []; }
function getStats() {
  const history = getHistory();
  const today = todayKey();
  return {
    total: history.length,
    today: history.filter(h => h.date === today).length,
    streak: store.get('streak') || 0
  };
}
function lastSameWorkout(workoutId) {
  const history = getHistory().filter(h => h.workoutId === workoutId);
  return history.length ? history[history.length - 1] : null;
}

async function saveWorkoutSession(session) {
  const history = getHistory();
  history.push(session);
  store.set('history', history);
  const dates = [...new Set(history.map(h => h.date))].sort();
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff <= 1.5) streak++; else break;
  }
  store.set('streak', streak);
  if (supabaseClient && currentUser && !currentUser.isGuest) {
    try {
      await supabaseClient.from('workouts').insert({
        user_id: currentUser.id,
        title: session.title,
        duration_seconds: session.duration,
        exercises: session.exercises || [],
        completed_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Cloud save skipped', e.message);
    }
  }
}

function isAppMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    new URLSearchParams(location.search).get('app') === '1'
  );
}

async function init() {
  // Browser without ?app=1 → marketing site (site.js). App / PWA → this shell.
  if (!isAppMode()) return;

  isPro = !!store.get('isPro');
  voiceEnabled = store.get('voiceEnabled') !== false;
  sfxEnabled = store.get('sfxEnabled') !== false;
  musicHintDismissed = !!store.get('musicHintDismissed');

  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      if (currentUser.email?.toLowerCase().includes('pro')) {
        isPro = true; store.set('isPro', true);
      }
    }
    supabaseClient.auth.onAuthStateChange((_e, s) => {
      currentUser = s?.user || null;
      if (currentUser?.email?.toLowerCase().includes('pro')) {
        isPro = true; store.set('isPro', true);
      }
      if (currentScreen !== 'workoutRun') render();
    });
  }
  if (!currentUser && store.get('guest')) {
    const g = store.get('guest');
    currentUser = { id: g.id || 'guest', email: g.email || 'guest@vyrn.app', isGuest: true };
  }
  // OAuth return hash
  if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
    currentScreen = 'home';
  }
  render();
}

function navigate(screen) {
  if (tickTimer && screen !== 'workoutRun') {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  currentScreen = screen;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const app = $('#app');
  if (!app) return;
  if (!currentUser && !['welcome', 'login'].includes(currentScreen)) currentScreen = 'welcome';
  const map = {
    welcome: renderWelcome, login: renderLogin, home: renderHome,
    library: renderLibrary, workoutDetail: renderWorkoutDetail, workoutRun: renderWorkoutRun,
    history: renderHistory, challenge: renderChallenge, challengeRun: renderChallengeRun,
    profile: renderProfile
  };
  app.innerHTML = (map[currentScreen] || renderWelcome)();
  bindEvents();
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
  return `<nav class="tabbar">
    <button class="tab ${active==='home'?'active':''}" data-go="home">Home</button>
    <button class="tab ${active==='library'?'active':''}" data-go="library">Workouts</button>
    <button class="tab ${active==='history'?'active':''}" data-go="history">History</button>
    <button class="tab ${active==='profile'?'active':''}" data-go="profile">Profile</button>
  </nav>`;
}

function renderWelcome() {
  return `<div class="screen center fade-in">
    <img class="brand-logo" src="/assets/logo.png" alt="Vyrn — show up. put in the work" />
    <p class="muted">Home · Office · Playground — no special gear</p>
    <div class="btn-stack">
      <button class="btn primary" data-go="login">Sign in / Sign up</button>
      <button class="btn ghost" data-action="guest">Continue as Guest</button>
    </div>
  </div>`;
}

function renderLogin() {
  return `<div class="screen center fade-in">
    <img class="brand-logo-sm" src="/assets/logo.png" alt="Vyrn" />
    <h2>Welcome</h2>
    <p class="muted mb">Sign in to sync history across devices</p>
    <div class="btn-stack" style="max-width:340px">
      <button class="btn oauth google" data-action="oauth-google">
        <span class="oauth-ico">G</span> Continue with Google
      </button>
      <button class="btn oauth apple" data-action="oauth-apple">
        <span class="oauth-ico"></span> Continue with Apple
      </button>
    </div>
    <div class="divider"><span>or email</span></div>
    <div class="form">
      <input id="email" type="email" placeholder="Email" autocomplete="email" />
      <input id="password" type="password" placeholder="Password (min 6)" autocomplete="current-password" />
      <button class="btn primary" data-action="signin">Sign In</button>
      <button class="btn secondary" data-action="signup">Create Account</button>
    </div>
    <p id="auth-msg" class="msg"></p>
    <div class="divider"><span>quick test</span></div>
    <div class="btn-stack" style="max-width:340px;margin-top:0">
      <button class="btn secondary" data-action="demo-free">Demo Free user</button>
      <button class="btn secondary" data-action="demo-pro">Demo Pro user</button>
      <button class="btn ghost" data-go="welcome">← Back</button>
    </div>
  </div>`;
}

function renderHome() {
  const stats = getStats();
  const name = currentUser?.email?.split('@')[0] || 'Athlete';
  const freeList = Object.values(WORKOUTS).filter(w => w.free);
  return `<div class="screen fade-in">
    <div class="topbar">
      <div>
        <p class="muted">Ready to Vyrn?</p>
        <h2>${name}</h2>
      </div>
      ${currentUser?.isGuest ? '<span class="badge">Guest</span>' : (isPro ? '<span class="badge pro">Pro</span>' : '')}
    </div>
    <div class="stats mb">
      <div class="stat"><div class="num">${stats.today}</div><div class="lbl">Today</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="lbl">Streak</div></div>
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">All-time</div></div>
    </div>
    <div class="card">
      <h3>Quick start</h3>
      <p class="muted mb">Pick a free session for where you are</p>
      ${freeList.map(w => `
        <button class="list-btn" data-workout="${w.id}">
          <span class="ex-ico">${iconFor(w.title)}</span>
          <span class="list-text"><strong>${w.title}</strong><br><span class="muted">${w.place} · ${w.durationLabel}</span></span>
          <span class="chev">→</span>
        </button>
      `).join('')}
    </div>
    <button class="btn secondary" data-go="library">Browse all workouts</button>
    ${renderLegalFooter()}
    ${renderTabBar('home')}
  </div>`;
}

function renderLibrary() {
  const places = ['Office', 'Home', 'Playground', 'Anywhere'];
  return `<div class="screen fade-in">
    <div class="topbar"><h2>Workouts</h2></div>
    <p class="muted mb">All sessions work with bodyweight only</p>
    ${places.map(place => {
      const items = Object.values(WORKOUTS).filter(w => w.place === place);
      if (!items.length) return '';
      return `<h3 class="section">${place}</h3>
        ${items.map(w => `
          <div class="card tight-pad">
            <button class="list-btn" data-workout="${w.id}">
              <span class="ex-ico">${iconFor(w.title)}</span>
              <span class="list-text">
                <strong>${w.title}</strong>
                ${!w.free && !isPro ? ' <span class="pro-tag">PRO</span>' : ''}
                <br><span class="muted">${w.durationLabel} · ${w.description}</span>
              </span>
              <span class="chev">→</span>
            </button>
          </div>
        `).join('')}`;
    }).join('')}
    ${renderLegalFooter()}
    ${renderTabBar('library')}
  </div>`;
}

function renderWorkoutDetail() {
  const w = WORKOUTS[store.get('selectedWorkout')];
  if (!w) return renderLibrary();
  const prev = lastSameWorkout(w.id);
  const locked = !w.free && !isPro;
  return `<div class="screen fade-in">
    <div class="topbar">
      <button class="back" data-go="library">←</button>
      <h2>${w.title}</h2>
    </div>
    <img class="photo-hero" src="${photoUrl(w.title)}" alt="${w.title}" />
    <p class="muted center">${w.place} · ${w.durationLabel}</p>
    <p class="mb center">${w.description}</p>
    ${prev ? `<div class="card highlight">
      <p class="muted">Last time</p>
      <p><strong>${formatTime(prev.duration)}</strong> · ${prev.date}</p>
      <p class="muted" style="font-size:12px">Finish faster to beat your best</p>
    </div>` : '<p class="muted mb center">First time — set your baseline</p>'}
    <div class="exercise-list">
      ${w.exercises.map((e, i) => `
        <div class="ex-item">
          <span class="ex-ico-sm">${iconFor(e.name)}</span>
          <span>${i + 1}. ${e.name}</span>
          <span class="muted">${e.duration}s</span>
        </div>
      `).join('')}
    </div>
    ${renderMusicBar(false)}
    ${locked
      ? `<button class="btn primary" data-action="upgrade">Unlock with Pro</button>
         <p class="muted center mt">Pro unlocks full library + longer history</p>`
      : `<button class="btn primary" data-action="start-session">Start</button>`}
  </div>`;
}

function renderWorkoutRun() {
  const w = activeWorkout;
  if (!w) return renderHome();
  const ex = w.exercises[exerciseIndex];
  const total = w.exercises.length;
  const label = phase === 'work' ? (ex?.name || '') : phase === 'rest' ? 'Rest' : phase === 'done' ? 'Session complete' : 'Get ready';
  const ico = phase === 'rest'
    ? iconSvg('stretch', 'icon-svg-lg')
    : phase === 'done'
      ? '<span class="icon-svg-lg" style="font-size:48px;line-height:64px">✓</span>'
      : iconSvg(ex?.name, 'icon-svg-lg');
  const pct = ((exerciseIndex + (phase === 'rest' ? 0.5 : phase === 'done' ? 1 : 0)) / total) * 100;
  return `<div class="screen center workout-focus fade-in">
    <p class="muted">${w.title} · ${Math.min(exerciseIndex + 1, total)}/${total}</p>
    <div class="ex-stage ${phase}">
      <div class="ex-icon-lg ${phase === 'work' ? 'bounce' : ''}">${ico}</div>
    </div>
    <div class="timer-display big" id="phase-timer">${formatTime(phaseSeconds)}</div>
    <h2 id="phase-label">${label}</h2>
    <p class="muted" id="phase-hint">${phase === 'work' ? 'Keep moving' : phase === 'rest' ? 'Breathe' : phase === 'done' ? 'Nice work' : 'Voice + sound on by default'}</p>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    ${phase === 'ready' ? renderMusicBar(true) : ''}
    <div class="btn-stack">
      ${phase === 'ready' ? `<button class="btn primary" data-action="begin-timer">Begin</button>` : ''}
      ${phase === 'done' ? `<button class="btn primary" data-action="save-session">Save & finish</button>` : ''}
      ${phase !== 'done' && phase !== 'ready' ? `<button class="btn ghost" data-action="skip-phase">Skip</button>` : ''}
      <button class="btn ghost" data-action="abort-session">Quit</button>
    </div>
  </div>`;
}

function renderHistory() {
  const history = getHistory().slice().reverse();
  const byDate = {};
  history.forEach(h => {
    if (!byDate[h.date]) byDate[h.date] = [];
    byDate[h.date].push(h);
  });
  const dates = Object.keys(byDate);
  return `<div class="screen fade-in">
    <div class="topbar"><h2>History</h2></div>
    ${!currentUser || currentUser.isGuest
      ? `<p class="muted mb">Guest data stays on this device. <a href="#" data-go="login" style="color:#ff3b2f">Sign in</a> to sync.</p>`
      : `<p class="muted mb">Signed in — cloud sync when available</p>`}
    ${dates.length === 0
      ? `<div class="card"><p class="muted center">No sessions yet. Complete a workout to see it here.</p></div>`
      : dates.map(date => `
        <h3 class="section">${date === todayKey() ? 'Today' : date}</h3>
        ${byDate[date].map(h => {
          const prev = getHistory().filter(x => x.workoutId === h.workoutId && x.at < h.at).pop();
          let cmp = '';
          if (prev) {
            const diff = h.duration - prev.duration;
            if (diff < 0) cmp = `<span class="better">−${formatTime(Math.abs(diff))} vs last</span>`;
            else if (diff > 0) cmp = `<span class="slower">+${formatTime(diff)} vs last</span>`;
            else cmp = `<span class="muted">Same as last</span>`;
          }
          return `<div class="card tight-pad">
            <div class="lb-row" style="border:none;padding:4px 0">
              <span class="ex-ico-sm">${iconFor(h.title)}</span>
              <span class="name"><strong>${h.title}</strong><br><span class="muted">${formatTime(h.duration)}</span></span>
              <span>${cmp}</span>
            </div>
          </div>`;
        }).join('')}
      `).join('')}
    ${renderLegalFooter()}
    ${renderTabBar('history')}
  </div>`;
}

function renderChallenge() {
  const entries = store.get('entries') || [];
  const sorted = [...entries].sort((a, b) => a.score_seconds - b.score_seconds).slice(0, 10);
  return `<div class="screen fade-in">
    <div class="topbar">
      <button class="back" data-go="home">←</button>
      <h2>Weekly Challenge</h2>
    </div>
    <div class="card">
      <h3>${DEFAULT_CHALLENGE.title}</h3>
      <p class="muted mb">${DEFAULT_CHALLENGE.description}</p>
      <div class="exercise-list">
        ${DEFAULT_CHALLENGE.exercises.map(e =>
          `<div class="ex-item"><span class="ex-ico-sm">${iconFor(e.name)}</span><span>${e.name}</span><span class="muted">${e.reps ? e.reps + ' reps' : e.duration_seconds + 's'}</span></div>`
        ).join('')}
      </div>
      <button class="btn primary mt" data-go="challengeRun">Start Challenge</button>
    </div>
    <h3 class="section">Leaderboard</h3>
    <div class="card tight">
      ${sorted.length === 0 ? '<p class="muted center" style="padding:16px">No entries yet</p>' :
        sorted.map((e, i) => `
          <div class="lb-row">
            <span class="rank">#${i + 1}</span>
            <span class="name">${e.name || 'Athlete'}</span>
            <span class="time">${formatTime(e.score_seconds)}</span>
          </div>`).join('')}
    </div>
    ${renderLegalFooter()}
    ${renderTabBar('home')}
  </div>`;
}

function renderChallengeRun() {
  return `<div class="screen center fade-in">
    <p class="muted">Challenge timer</p>
    <div class="timer-display big" id="c-timer">0:00</div>
    <div class="exercise-list left">
      ${DEFAULT_CHALLENGE.exercises.map(e =>
        `<div class="ex-item"><span class="ex-ico-sm">${iconFor(e.name)}</span><span>${e.name}</span><span class="muted">${e.reps ? e.reps + ' reps' : e.duration_seconds + 's'}</span></div>`
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
  return `<div class="screen fade-in">
    <div class="center mb">
      <div class="avatar">${(currentUser?.email?.[0] || 'V').toUpperCase()}</div>
      <p class="muted">${currentUser?.email || 'Guest'}</p>
      ${currentUser?.isGuest ? '<p class="muted" style="font-size:12px">Local only — sign in to sync</p>' : ''}
    </div>
    <div class="card">
      <h3>${isPro ? 'Pro' : 'Free'} plan</h3>
      <p class="muted mb">${isPro
        ? 'Full library, unlimited history, comparisons.'
        : 'Free: 4 core workouts, history on this device. Pro ($7/mo): full library + more.'}</p>
      ${!isPro
        ? `<button class="btn primary" data-action="upgrade">Upgrade to Pro — $7/mo</button>`
        : `<button class="btn ghost" data-action="downgrade">Manage (demo: switch to Free)</button>`}
    </div>
    <div class="card">
      <h3>Audio</h3>
      <div class="toggle-row">
        <span>Voice coaching</span>
        <button class="toggle ${voiceEnabled?'on':''}" data-action="toggle-voice">${voiceEnabled?'On':'Off'}</button>
      </div>
      <div class="toggle-row">
        <span>Sound effects</span>
        <button class="toggle ${sfxEnabled?'on':''}" data-action="toggle-sfx">${sfxEnabled?'On':'Off'}</button>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">Music: use Spotify or Apple Music in the background. Deep in-app integrate comes next.</p>
      <div class="music-actions" style="margin-top:10px">
        <a class="btn secondary music-link" href="https://open.spotify.com/search/workout%20focus" target="_blank" rel="noopener">Spotify</a>
        <a class="btn secondary music-link" href="https://music.apple.com/search?term=workout" target="_blank" rel="noopener">Apple Music</a>
      </div>
    </div>
    <div class="stats mt">
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">Sessions</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="lbl">Streak</div></div>
    </div>
    <button class="btn ghost mt" data-go="challenge">Weekly Challenge</button>
    <button class="btn ghost" data-action="signout">Sign Out</button>
    ${renderLegalFooter()}
    ${renderTabBar('profile')}
  </div>`;
}

function bindEvents() {
  $all('[data-go]').forEach(el => el.onclick = (e) => { e.preventDefault(); navigate(el.dataset.go); });
  $all('[data-action]').forEach(el => el.onclick = () => handleAction(el.dataset.action));
  $all('[data-workout]').forEach(el => el.onclick = () => {
    store.set('selectedWorkout', el.dataset.workout);
    navigate('workoutDetail');
  });
}

function startPhaseTimer() {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    phaseSeconds--;
    totalSeconds++;
    const el = $('#phase-timer');
    if (el) el.textContent = formatTime(Math.max(0, phaseSeconds));
    if (phaseSeconds === 3 || phaseSeconds === 2 || phaseSeconds === 1) sfxTick();
    if (phaseSeconds <= 0) advancePhase();
  }, 1000);
}

function advancePhase() {
  clearInterval(tickTimer);
  const w = activeWorkout;
  if (!w) return;

  if (phase === 'work') {
    const rest = w.exercises[exerciseIndex]?.rest || 0;
    if (rest > 0) {
      phase = 'rest';
      phaseSeconds = rest;
      sfxRest();
      speak('Rest');
      render();
      startPhaseTimer();
      return;
    }
  }

  if (phase === 'work' || phase === 'rest') {
    exerciseIndex++;
    if (exerciseIndex >= w.exercises.length) {
      phase = 'done';
      sfxDone();
      speak('Session complete. Great work.');
      render();
      return;
    }
    phase = 'work';
    phaseSeconds = w.exercises[exerciseIndex].duration;
    sfxStart();
    speak(w.exercises[exerciseIndex].name);
    render();
    startPhaseTimer();
  }
}

async function handleAction(action) {
  const msg = $('#auth-msg');

  if (action === 'guest') {
    store.set('guest', { email: 'guest@vyrn.app', id: 'guest' });
    currentUser = { id: 'guest', email: 'guest@vyrn.app', isGuest: true };
    isPro = false; store.set('isPro', false);
    navigate('home');
    return;
  }
  if (action === 'demo-free') {
    store.set('guest', { email: 'free@vyrn.demo', id: 'demo-free' });
    currentUser = { id: 'demo-free', email: 'free@vyrn.demo', isGuest: true };
    isPro = false; store.set('isPro', false);
    navigate('home');
    return;
  }
  if (action === 'demo-pro') {
    store.set('guest', { email: 'pro@vyrn.demo', id: 'demo-pro' });
    currentUser = { id: 'demo-pro', email: 'pro@vyrn.demo', isGuest: true };
    isPro = true; store.set('isPro', true);
    navigate('home');
    return;
  }

  if (action === 'oauth-google' || action === 'oauth-apple') {
    const provider = action === 'oauth-google' ? 'google' : 'apple';
    if (!supabaseClient) {
      if (msg) msg.textContent = 'Auth unavailable offline. Use Demo or Email.';
      return;
    }
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/' }
      });
      if (error) throw error;
    } catch (e) {
      if (msg) msg.textContent = (e.message || 'Provider not configured') +
        ' — enable Google/Apple in Supabase Auth, or use Email / Demo.';
    }
    return;
  }

  if (action === 'signin' || action === 'signup') {
    const email = $('#email')?.value?.trim();
    const password = $('#password')?.value;
    if (!email || !password) { if (msg) msg.textContent = 'Fill in all fields'; return; }
    if (!supabaseClient) {
      store.set('guest', { email });
      currentUser = { id: 'local', email, isGuest: true };
      navigate('home');
      return;
    }
    try {
      if (action === 'signup') {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (msg) msg.textContent = 'Check email to confirm, or try Sign In.';
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
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
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    store.set('guest', null);
    navigate('welcome');
    return;
  }

  if (action === 'upgrade') {
    isPro = true; store.set('isPro', true);
    alert('Pro unlocked (demo). Full library available.');
    render();
    return;
  }
  if (action === 'downgrade') {
    isPro = false; store.set('isPro', false);
    render();
    return;
  }
  if (action === 'toggle-voice') {
    voiceEnabled = !voiceEnabled;
    store.set('voiceEnabled', voiceEnabled);
    if (voiceEnabled) speak('Voice on');
    render();
    return;
  }
  if (action === 'toggle-sfx') {
    sfxEnabled = !sfxEnabled;
    store.set('sfxEnabled', sfxEnabled);
    if (sfxEnabled) sfxStart();
    render();
    return;
  }

  if (action === 'start-session') {
    const id = store.get('selectedWorkout');
    const w = WORKOUTS[id];
    if (!w) return;
    if (!w.free && !isPro) { handleAction('upgrade'); return; }
    activeWorkout = w;
    exerciseIndex = 0;
    phase = 'ready';
    phaseSeconds = w.exercises[0].duration;
    totalSeconds = 0;
    navigate('workoutRun');
    return;
  }

  if (action === 'begin-timer') {
    ensureAudio();
    phase = 'work';
    phaseSeconds = activeWorkout.exercises[0].duration;
    totalSeconds = 0;
    sfxStart();
    speak(activeWorkout.exercises[0].name);
    render();
    startPhaseTimer();
    return;
  }

  if (action === 'skip-phase') {
    phaseSeconds = 0;
    advancePhase();
    return;
  }

  if (action === 'abort-session') {
    clearInterval(tickTimer);
    window.speechSynthesis?.cancel();
    activeWorkout = null;
    navigate('home');
    return;
  }

  if (action === 'save-session') {
    clearInterval(tickTimer);
    const w = activeWorkout;
    const session = {
      workoutId: w.id,
      title: w.title,
      duration: totalSeconds,
      date: todayKey(),
      at: Date.now(),
      exercises: w.exercises.map(e => e.name)
    };
    await saveWorkoutSession(session);
    const prev = getHistory().filter(h => h.workoutId === w.id && h.at < session.at).pop();
    let extra = '';
    if (prev) {
      const diff = session.duration - prev.duration;
      if (diff < 0) extra = `\nYou were ${formatTime(Math.abs(diff))} faster than last time.`;
      else if (diff > 0) extra = `\n${formatTime(diff)} slower than last time — still counts.`;
      else extra = '\nMatched your last time.';
    }
    alert(`Saved · ${formatTime(totalSeconds)}${extra}`);
    activeWorkout = null;
    navigate('history');
    return;
  }

  if (action === 'toggle-challenge') {
    if (!window._cRunning) {
      window._cRunning = true;
      window._cSec = 0;
      ensureAudio();
      sfxStart();
      speak('Challenge started');
      $('#c-toggle').textContent = 'Pause';
      $('#c-finish').classList.remove('hidden');
      window._cTimer = setInterval(() => {
        window._cSec++;
        $('#c-timer').textContent = formatTime(window._cSec);
      }, 1000);
    } else {
      window._cRunning = false;
      clearInterval(window._cTimer);
      $('#c-toggle').textContent = 'Resume';
    }
    return;
  }

  if (action === 'finish-challenge') {
    clearInterval(window._cTimer);
    window._cRunning = false;
    sfxDone();
    speak('Time submitted');
    const entries = store.get('entries') || [];
    const name = currentUser?.email?.split('@')[0] || 'Athlete';
    const filtered = entries.filter(e => e.user_id !== (currentUser?.id || 'guest'));
    filtered.push({ user_id: currentUser?.id || 'guest', name, score_seconds: window._cSec || 0, at: Date.now() });
    store.set('entries', filtered);
    alert(`Submitted · ${formatTime(window._cSec || 0)}`);
    navigate('challenge');
  }
}

document.addEventListener('DOMContentLoaded', init);
