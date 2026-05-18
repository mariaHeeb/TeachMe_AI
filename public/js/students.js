import { STUDENTS } from './config.js';

const stateClasses = ['active', 'thinking', 'speaking', 'hand-up', 'reacting'];

// Per-student blink timing (duration in seconds, negative delay = offset into cycle)
const BLINK_DURS   = [5.4, 4.2, 6.8, 3.9, 5.1, 7.2, 4.6, 6.0, 4.8, 5.7, 3.7, 6.4, 5.0, 4.4];
const BLINK_DELAYS = [0, -1.6, -3.4, -0.9, -2.8, -4.2, -1.3, -3.9, -2.2, -5.0, -0.6, -3.1, -4.7, -1.9];

// Per-student breathing rhythm
const BREATH_DURS   = [4.8, 5.3, 4.5, 5.8, 4.2, 6.0, 5.0, 4.7, 5.5, 4.4, 5.9, 4.3, 6.2, 5.1];
const BREATH_DELAYS = [0, -1.2, -2.8, -0.5, -3.6, -1.8, -4.0, -0.8, -2.4, -3.2, -1.5, -4.4, -0.3, -2.9];

// Round-robin fairness tracker
const speakCount = {};
STUDENTS.forEach(s => { speakCount[s.name] = 0; });

// Maps each hair style to a CSS class for back/front hair layers
const HAIR_BACK_CLASS = {
  'long-straight': 'hb-long-straight',
  'afro-puffs':    'hb-afro-puffs',
  'long-bangs':    'hb-long-bangs',
  'curly-short':   'hb-curly-short',
  'messy-short':   'hb-messy-short',
  'straight-short':'hb-straight-short',
  'bun':           'hb-bun',
};

const HAIR_FRONT_CLASS = {
  'long-straight': '',
  'afro-puffs':    '',
  'long-bangs':    'hf-bangs',
  'curly-short':   'hf-curly-top',
  'messy-short':   'hf-messy-top',
  'straight-short':'',
  'bun':           'hf-bun-top',
};

export function renderStudents() {
  const backRow  = document.getElementById('backRow');
  const midRow   = document.getElementById('midRow');
  const frontRow = document.getElementById('frontRow');
  backRow.innerHTML  = '';
  if (midRow) midRow.innerHTML = '';
  frontRow.innerHTML = '';

  STUDENTS.forEach((student, i) => {
    const card = buildCard(student, i);
    if      (student.row === 'back'              ) backRow.appendChild(card);
    else if (student.row === 'mid'  && midRow    ) midRow.appendChild(card);
    else                                           frontRow.appendChild(card);
  });
}

function buildCard(student, index) {
  const el = document.createElement('article');
  el.className = 'student-card';
  el.dataset.student = student.name;
  el.style.cssText = `
    --skin:       ${student.skin};
    --hair:       ${student.hair};
    --shirt:      ${student.shirt};
    --eye:        ${student.eyeColor};
    --accent:     ${student.color};
    --blink-dur:  ${BLINK_DURS[index % BLINK_DURS.length]}s;
    --blink-del:  ${BLINK_DELAYS[index % BLINK_DELAYS.length]}s;
    --breath-dur: ${BREATH_DURS[index % BREATH_DURS.length]}s;
    --breath-del: ${BREATH_DELAYS[index % BREATH_DELAYS.length]}s;
  `;
  if (student.gender) el.dataset.gender = student.gender;

  const hairBack  = HAIR_BACK_CLASS[student.hairStyle]  || '';
  const hairFront = HAIR_FRONT_CLASS[student.hairStyle] || '';

  el.innerHTML = `
    <div class="student-aura"></div>
    <div class="thinking-dots"><i></i><i></i><i></i></div>
    <div class="speech-bubble"><span class="bubble-text"></span></div>

    <div class="student-avatar">
      <!-- Hair back -->
      <div class="hair-back ${hairBack}"></div>
      <!-- Ears -->
      <div class="ear ear-l"></div>
      <div class="ear ear-r"></div>
      <!-- Head with face -->
      <div class="head">
        <div class="eyebrow eb-l"></div>
        <div class="eyebrow eb-r"></div>
        <div class="eye eye-l">
          <div class="iris"><div class="pupil"></div><div class="shine"></div></div>
        </div>
        <div class="eye eye-r">
          <div class="iris"><div class="pupil"></div><div class="shine"></div></div>
        </div>
        <div class="nose"></div>
        <div class="cheek cheek-l"></div>
        <div class="cheek cheek-r"></div>
        <div class="mouth"></div>
        ${student.glasses ? `<div class="glasses"><div class="glasses-bridge"></div></div>` : ''}
      </div>
      <!-- Hair front (bangs / top detail) -->
      ${hairFront ? `<div class="hair-front ${hairFront}"></div>` : ''}
      <!-- Body -->
      <div class="neck"></div>
      <div class="body"></div>
      <div class="arm arm-l"><div class="hand"></div></div>
      <div class="arm arm-r"><div class="hand"></div></div>
    </div>

    <div class="desk"></div>
    <div class="student-name">
      <span class="name-dot"></span>${escapeHtml(student.name)}
    </div>
  `;

  return el;
}

// ── Exported state functions ──────────────────────────

export function getStudentNames() {
  return STUDENTS.map(s => s.name);
}

export function getStudentProfiles() {
  return STUDENTS.map(s => ({ name: s.name, mood: s.mood }));
}

export function getStudentByName(name) {
  return STUDENTS.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
}

/** Weighted random with round-robin fairness bonus */
export function getRandomStudent() {
  const minCount = Math.min(...STUDENTS.map(s => speakCount[s.name]));
  let total = 0;
  const pool = STUDENTS.map(s => {
    const w = (s.weight || 1) + (speakCount[s.name] === minCount ? 3 : 0);
    total += w;
    return { student: s, weight: w };
  });
  let rand = Math.random() * total;
  for (const p of pool) {
    rand -= p.weight;
    if (rand <= 0) return p.student;
  }
  return STUDENTS[STUDENTS.length - 1];
}

export function recordStudentSpoke(name) {
  if (name in speakCount) speakCount[name]++;
}

export function setAllStudentsIdle() {
  document.querySelectorAll('.student-card').forEach(el => {
    stateClasses.forEach(c => el.classList.remove(c));
    hideSpeechBubble(el);
  });
}

export function setStudentThinking(name) {
  setAllStudentsIdle();
  const el = find(name);
  if (el) {
    el.classList.add('active', 'thinking', 'hand-up');
    showReactingStudents(name, 1);
  }
}

export function setStudentSpeaking(name, text) {
  document.querySelectorAll('.student-card').forEach(el => {
    stateClasses.forEach(c => el.classList.remove(c));
  });
  const el = find(name);
  if (el) {
    el.classList.add('active', 'speaking', 'hand-up');
    if (text) showSpeechBubble(el, text);
    showListeningGlow(name);
  }
}

export function showStudentSpeechBubble(name, text) {
  const el = find(name);
  if (el && text) showSpeechBubble(el, text);
}

export function clearStudentSpeechBubble(name) {
  const el = find(name);
  if (el) hideSpeechBubble(el);
}

export function flashRandomStudent() {
  const idle = Array.from(document.querySelectorAll('.student-card'))
    .filter(el => !el.classList.contains('speaking') && !el.classList.contains('thinking'));
  if (!idle.length) return;
  const el = idle[Math.floor(Math.random() * idle.length)];
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 900);
}

/** Each student has their own independent idle behavior loop */
export function startIdleAnimations() {
  const LOOK_CLASSES    = ['idle-look-left', 'idle-look-right'];
  const POSTURE_CLASSES = ['posture-left', 'posture-right'];

  function scheduleIdleLook(el, initialDelay) {
    setTimeout(function tick() {
      const busy = el.classList.contains('speaking') || el.classList.contains('thinking');
      if (!busy) {
        const look     = LOOK_CLASSES[Math.floor(Math.random() * LOOK_CLASSES.length)];
        const duration = 1400 + Math.random() * 1200; // 1.4 – 2.6 s
        LOOK_CLASSES.forEach(c => el.classList.remove(c));
        el.classList.add(look);
        setTimeout(() => el.classList.remove(look), duration);
      }
      // next look: 6 – 16 s from now (each student on their own schedule)
      setTimeout(tick, 6000 + Math.random() * 10000);
    }, initialDelay);
  }

  function schedulePostureShift(el, initialDelay) {
    setTimeout(function tick() {
      const busy = el.classList.contains('speaking') || el.classList.contains('thinking');
      if (!busy) {
        const p        = POSTURE_CLASSES[Math.floor(Math.random() * POSTURE_CLASSES.length)];
        const duration = 3000 + Math.random() * 2000; // 3 – 5 s
        POSTURE_CLASSES.forEach(c => el.classList.remove(c));
        el.classList.add(p);
        setTimeout(() => el.classList.remove(p), duration);
      }
      setTimeout(tick, 8000 + Math.random() * 10000);
    }, initialDelay);
  }

  // Give each card a randomised initial offset so they never all move at once
  document.querySelectorAll('.student-card').forEach((card, i) => {
    const lookOffset    = i * 700 + Math.random() * 2000;
    const postureOffset = i * 900 + Math.random() * 4000;
    scheduleIdleLook(card, lookOffset);
    schedulePostureShift(card, postureOffset);
  });
}

/** A few nearby students lean naturally toward the active speaker */
export function setStudentLeaning(speakerName) {
  const cards = Array.from(document.querySelectorAll('.student-card'));
  const speakerEl = find(speakerName);
  if (!speakerEl) return;
  const speakerRect   = speakerEl.getBoundingClientRect();
  const speakerCenter = speakerRect.left + speakerRect.width / 2;

  const others  = cards.filter(el => el.dataset.student !== speakerName);
  const count   = Math.min(3, Math.floor(others.length / 2));
  const leaners = shuffle(others).slice(0, count);

  leaners.forEach((el, i) => {
    const stagger = i * 120 + Math.random() * 180;
    setTimeout(() => {
      ['leaning-left', 'leaning-right'].forEach(c => el.classList.remove(c));
      const rect   = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const lean   = center < speakerCenter ? 'leaning-right' : 'leaning-left';
      el.classList.add(lean);
      setTimeout(() => el.classList.remove(lean), 2500 + Math.random() * 800);
    }, stagger);
  });
}

// ── Internal helpers ──────────────────────────────────

function showSpeechBubble(el, text) {
  const bubble = el.querySelector('.speech-bubble');
  const span   = el.querySelector('.bubble-text');
  if (!bubble || !span) return;
  span.textContent = text;
  bubble.classList.add('visible');
}

function hideSpeechBubble(el) {
  const bubble = el.querySelector('.speech-bubble');
  if (bubble) bubble.classList.remove('visible');
}

function showReactingStudents(speakerName, count) {
  const others = Array.from(document.querySelectorAll('.student-card'))
    .filter(el => el.dataset.student !== speakerName &&
                  !el.classList.contains('speaking'));
  shuffle(others).slice(0, count).forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('reacting', 'active');
      setTimeout(() => el.classList.remove('reacting', 'active'), 2000);
    }, i * 280);
  });
}

function showListeningGlow(speakerName) {
  const others = Array.from(document.querySelectorAll('.student-card'))
    .filter(el => el.dataset.student !== speakerName);
  // Stagger 4 nearby students — not all at once
  shuffle(others).slice(0, 4).forEach((el, i) => {
    setTimeout(() => el.classList.add('active'), i * 120 + Math.random() * 100);
  });
}

function find(name) {
  return document.querySelector(`.student-card[data-student="${CSS.escape(name)}"]`)
      || document.querySelector('.student-card');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(v) {
  return String(v).replace(/[&<>'"]/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}
