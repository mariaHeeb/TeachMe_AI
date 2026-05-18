import { API_TURN_URL, DEFAULT_TOPIC, STUDENTS } from './config.js';
import {
  renderStudents, getStudentNames, getStudentProfiles,
  getStudentByName, getRandomStudent, recordStudentSpoke,
  setAllStudentsIdle, setStudentThinking, setStudentSpeaking,
  clearStudentSpeechBubble, flashRandomStudent,
  startIdleAnimations, setStudentLeaning
} from './students.js';
import { VoiceTurnRecorder, blobToBase64 } from './audio.js';

/* ─────────────────────────────────────────────────
   DOM REFS
───────────────────────────────────────────────── */
const dom = {
  // Screens
  loginScreen:        document.getElementById('loginScreen'),
  setupScreen:        document.getElementById('setupScreen'),
  appScreen:          document.getElementById('appScreen'),
  aboutScreen:        document.getElementById('aboutScreen'),
  aboutStars:         document.getElementById('aboutStars'),
  openAboutBtn:       document.getElementById('openAboutBtn'),
  aboutBackBtn:       document.getElementById('aboutBackBtn'),
  aboutGetStartedBtn: document.getElementById('aboutGetStartedBtn'),

  // Login
  loginStars:        document.getElementById('loginStars'),
  signinForm:        document.getElementById('signinForm'),
  signupForm:        document.getElementById('signupForm'),

  // Setup
  setupStars:        document.getElementById('setupStars'),
  setupBackBtn:      document.getElementById('setupBackBtn'),
  topicInput:        document.getElementById('topicInput'),
  charCount:         document.getElementById('charCount'),
  dropZone:          document.getElementById('dropZone'),
  fileInput:         document.getElementById('fileInput'),
  fileList:          document.getElementById('fileList'),
  startClassBtn:     document.getElementById('startClassBtn'),

  // Topic-change modal
  topicModal:        document.getElementById('topicModal'),
  topicModalInput:   document.getElementById('topicModalInput'),
  topicModalCancel:  document.getElementById('topicModalCancel'),
  topicModalSave:    document.getElementById('topicModalSave'),

  // Classroom
  buntingLine:       document.getElementById('buntingLine'),
  micButton:         document.getElementById('micButton'),
  levelMeter:        document.getElementById('levelMeter'),
  statusDot:         document.getElementById('statusDot'),
  mainStatus:        document.getElementById('mainStatus'),
  subStatus:         document.getElementById('subStatus'),
  heardLine:         document.getElementById('heardLine'),
  sensitivitySelect: document.getElementById('sensitivitySelect'),
  topicButton:       document.getElementById('topicButton'),
  topicLabel:        document.getElementById('topicLabel'),
  boardTopic:        document.getElementById('boardTopic'),
  timerText:         document.getElementById('timerText'),
  askButton:         document.getElementById('askButton'),
  endButton:         document.getElementById('endButton'),
  openLogButton:     document.getElementById('openLogButton'),
  closeLogButton:    document.getElementById('closeLogButton'),
  activityPanel:     document.getElementById('activityPanel'),
  activityList:      document.getElementById('activityList'),
  endModal:          document.getElementById('endModal'),
  endStats:          document.getElementById('endStats'),
  btnContinue:       document.getElementById('btnContinue'),
  btnNewSession:     document.getElementById('btnNewSession'),
  btnGoHome:         document.getElementById('btnGoHome'),
  studentsStage:     document.getElementById('studentsStage'),
  toast:             document.getElementById('toast'),
};

/* ─────────────────────────────────────────────────
   APP STATE
───────────────────────────────────────────────── */
let topic            = DEFAULT_TOPIC;
let history          = [];
let activityItems    = [];
let classStartedAt   = Date.now();
let quotaPauseUntil  = 0;
let studentIsSpeaking = false;
let turnCount        = 0;
let uploadedFiles    = [];   // File objects from setup screen

const recorder = new VoiceTurnRecorder({
  onStatus: handleRecorderStatus,
  onMeter:  handleMeter,
  onTurn:   handleTeacherTurn,
  onError:  handleRecorderError,
});

/* ─────────────────────────────────────────────────
   VOICE SELECTION — gender-aware, per-student cache
───────────────────────────────────────────────── */
const _voiceCache = {};

function pickVoice(studentName, gender) {
  if (_voiceCache[studentName]) return _voiceCache[studentName];

  const voices = speechSynthesis.getVoices();
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  if (!enVoices.length) return null;

  const femaleKeys = ['zira','aria','jenny','sonia','samantha','victoria','karen','moira','fiona','hazel','natasha','tessa','stephanie'];
  const maleKeys   = ['guy','david','mark','james','daniel','lee','fred','aaron','rishi','thomas','evan','oliver'];

  const genderKeys = gender === 'male' ? maleKeys : femaleKeys;
  const otherKeys  = gender === 'male' ? femaleKeys : maleKeys;

  const genderVoices = enVoices.filter(v => genderKeys.some(k => v.name.toLowerCase().includes(k)));
  const fallbackVoices = enVoices.filter(v => otherKeys.some(k => v.name.toLowerCase().includes(k)));

  const pool = genderVoices.length ? genderVoices : fallbackVoices.length ? fallbackVoices : enVoices;

  const usedInPool = Object.values(_voiceCache).filter(v => pool.includes(v)).length;
  const voice = pool[usedInPool % pool.length];

  _voiceCache[studentName] = voice || null;
  return _voiceCache[studentName];
}

/* ─────────────────────────────────────────────────
   BOOT  — runs immediately on page load
───────────────────────────────────────────────── */
buildStars(dom.loginStars);
initAbout();
initLanding();
initLogin();
initSetupEvents();   // bind setup events once — handlers reference module-level vars so re-init isn't needed

/* ═════════════════════════════════════════════════
   ABOUT PAGE
═════════════════════════════════════════════════ */
function initAbout() {
  document.querySelectorAll('.js-open-about').forEach(btn => btn.addEventListener('click', showAbout));
  dom.aboutBackBtn?.addEventListener('click', hideAbout);
  dom.aboutGetStartedBtn?.addEventListener('click', () => {
    // Snap-hide About, then go straight to Setup with no login screen flicker
    dom.aboutScreen.classList.remove('fade-in', 'fade-out');
    dom.aboutScreen.classList.add('hidden');
    // Hide login screen instantly (no fade) so it never appears between About and Setup
    dom.loginScreen.style.display = 'none';
    dom.loginScreen.classList.remove('fade-out');
    showSetup();
  });
}

function initLanding() {
  document.querySelectorAll('.js-start').forEach(btn => btn.addEventListener('click', enterSetup));
}

function showAbout() {
  if (!dom.aboutStars._built) {
    buildStars(dom.aboutStars);
    dom.aboutStars._built = true;
  }
  // Remove hidden (display:none) BEFORE resetting scroll — browsers ignore scrollTop on hidden elements
  dom.aboutScreen.classList.remove('hidden', 'fade-out');
  dom.aboutScreen.scrollTop = 0;
  dom.aboutScreen.classList.add('fade-in');
}

function hideAbout() {
  dom.loginScreen.scrollTop = 0;  // reset while About overlay still covers it
  dom.aboutScreen.classList.add('fade-out');
  setTimeout(() => {
    dom.aboutScreen.classList.remove('fade-in', 'fade-out');
    dom.aboutScreen.classList.add('hidden');
  }, 380);
}

/* ═════════════════════════════════════════════════
   SCREEN 1 — LOGIN
═════════════════════════════════════════════════ */
function initLogin() {
  // Tab switching
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.login-form').forEach(f => {
        f.classList.toggle('active', f.dataset.form === target);
      });
    });
  });

  dom.signinForm.addEventListener('submit', e => { e.preventDefault(); enterSetup(); });
  dom.signupForm.addEventListener('submit', e => { e.preventDefault(); enterSetup(); });
}

function enterSetup() {
  dom.loginScreen.classList.add('fade-out');
  setTimeout(() => {
    dom.loginScreen.style.display = 'none';
    showSetup();
  }, 380);
}

/* ═════════════════════════════════════════════════
   SCREEN 2 — SESSION SETUP
═════════════════════════════════════════════════ */
function showSetup(preFill = '') {
  // Reset setup state
  uploadedFiles = [];
  const safe = preFill.slice(0, 80);
  dom.topicInput.value = safe;
  dom.charCount.textContent = safe.length;
  dom.charCount.parentElement.className = 'char-count' +
    (safe.length >= 80 ? ' at-limit' : safe.length >= 64 ? ' near-limit' : '');
  dom.startClassBtn.disabled = safe.trim().length === 0;
  renderFileList();

  dom.setupScreen.classList.remove('hidden', 'fade-out');
  dom.setupScreen.classList.add('fade-in');
  requestAnimationFrame(() => dom.topicInput.focus());

  buildBunting();          // also used in classroom — safe to call early
  buildStars(dom.setupStars);
  // initSetupEvents bound once at boot — no need to rebind
}

function setupGoBack() {
  dom.setupScreen.classList.add('fade-out');
  setTimeout(() => {
    dom.setupScreen.classList.remove('fade-out', 'fade-in');
    dom.setupScreen.classList.add('hidden');
    dom.loginScreen.style.display = '';
    dom.loginScreen.scrollTop = 0;
    dom.loginScreen.classList.remove('fade-out');
    dom.loginScreen.style.opacity = '0';
    void dom.loginScreen.offsetWidth;
    dom.loginScreen.style.transition = 'opacity 380ms ease';
    dom.loginScreen.style.opacity = '1';
    setTimeout(() => { dom.loginScreen.style.transition = ''; }, 400);
  }, 380);
}

function initSetupEvents() {
  // Guard: called once at boot, ignore subsequent calls
  if (dom.topicInput._setupBound) return;
  dom.topicInput._setupBound = true;

  // Go Back button → return to landing page
  dom.setupBackBtn.addEventListener('click', setupGoBack);

  // Topic input live validation
  dom.topicInput.addEventListener('input', () => {
    const len = dom.topicInput.value.length;
    dom.charCount.textContent = len;
    // Set class on the OUTER wrapper span (parent of #charCount) to avoid inheriting .char-count position rules
    dom.charCount.parentElement.className = 'char-count' +
      (len >= 80 ? ' at-limit' : len >= 64 ? ' near-limit' : '');
    dom.startClassBtn.disabled = dom.topicInput.value.trim().length === 0;
  });

  dom.topicInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !dom.startClassBtn.disabled) startClass();
  });

  // Quick-pick suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      dom.topicInput.value = chip.dataset.topic;
      dom.topicInput.dispatchEvent(new Event('input'));
      dom.topicInput.focus();
    });
  });

  // Drop zone — click to browse
  dom.dropZone.addEventListener('click', e => {
    if (!e.target.classList.contains('browse-trigger')) {
      dom.fileInput.click();
    }
  });

  document.querySelector('.browse-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    dom.fileInput.click();
  });

  dom.dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dom.fileInput.click(); }
  });

  // Drag & drop
  dom.dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dom.dropZone.classList.add('drag-over');
  });

  dom.dropZone.addEventListener('dragleave', e => {
    if (!dom.dropZone.contains(e.relatedTarget)) {
      dom.dropZone.classList.remove('drag-over');
    }
  });

  dom.dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dom.dropZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });

  // File input change
  dom.fileInput.addEventListener('change', () => {
    addFiles(dom.fileInput.files);
    dom.fileInput.value = '';
  });

  // Start Class button
  dom.startClassBtn.addEventListener('click', startClass);
}

function addFiles(fileList) {
  Array.from(fileList).forEach(file => {
    const isDup = uploadedFiles.some(f => f.name === file.name && f.size === file.size);
    if (!isDup) uploadedFiles.push(file);
  });
  renderFileList();
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  if (uploadedFiles.length === 0) {
    dom.fileList.innerHTML = '';
    return;
  }

  dom.fileList.innerHTML = uploadedFiles.map((file, i) => `
    <li class="file-item">
      <span class="file-type-icon">${fileIcon(file.name)}</span>
      <div class="file-info">
        <span class="file-name">${escapeHtml(file.name)}</span>
        <span class="file-size">${formatBytes(file.size)}</span>
      </div>
      <button class="file-remove" data-idx="${i}" title="Remove file" aria-label="Remove ${escapeHtml(file.name)}">✕</button>
    </li>
  `).join('');

  dom.fileList.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFile(parseInt(btn.dataset.idx, 10)));
  });
}

function startClass() {
  const topicValue = dom.topicInput.value.trim();
  if (!topicValue) return;

  topic = topicValue;

  dom.setupScreen.classList.add('fade-out');
  setTimeout(() => {
    dom.setupScreen.classList.add('hidden');
    dom.setupScreen.classList.remove('fade-out', 'fade-in');
    enterClassroom();
  }, 380);
}

/* ═════════════════════════════════════════════════
   SCREEN 3 — CLASSROOM
═════════════════════════════════════════════════ */
function enterClassroom() {
  dom.appScreen.classList.remove('hidden');
  dom.appScreen.classList.add('fade-in');

  // Sync topic from setup
  dom.topicLabel.textContent = topic;
  dom.boardTopic.textContent = topic;

  renderStudents();
  bindClassroomEvents();
  startTimer();
  startIdleLife();
  startIdleAnimations();
  addActivity('System', `Classroom is ready. Today's topic: "${topic}". Press the microphone and start teaching!`);
  setStatus('Ready — press the microphone', 'Students will listen and react after you speak.', 'ready');

  // Warn if Gemini key is missing
  fetch('/api/config').then(r => r.json()).then(cfg => {
    if (!cfg.hasGeminiKey) {
      showToast('⚠ No Gemini API key found — add GEMINI_API_KEY to your .env and restart.');
      setStatus('Gemini key missing', 'Add GEMINI_API_KEY to your .env file and restart the server.', 'error');
    }
  }).catch(() => {});
}

function bindClassroomEvents() {
  if (dom.micButton._bound) return;
  dom.micButton._bound = true;

  dom.micButton.addEventListener('click', handleMicClick);

  dom.sensitivitySelect.addEventListener('change', () =>
    recorder.setSensitivity(dom.sensitivitySelect.value));

  dom.topicButton.addEventListener('click', openTopicModal);
  dom.askButton.addEventListener('click', askManualQuestion);
  dom.endButton.addEventListener('click', openEndModal);

  // Topic modal actions
  dom.topicModalCancel.addEventListener('click', closeTopicModal);
  dom.topicModalSave.addEventListener('click', saveTopicModal);
  dom.topicModalInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveTopicModal();
    if (e.key === 'Escape') closeTopicModal();
  });
  dom.topicModal.addEventListener('click', e => {
    if (e.target === dom.topicModal) closeTopicModal();
  });

  dom.openLogButton.addEventListener('click',  () => dom.activityPanel.classList.add('open'));
  dom.closeLogButton.addEventListener('click', () => dom.activityPanel.classList.remove('open'));

  dom.btnContinue.addEventListener('click', () => dom.endModal.classList.remove('open'));
  dom.btnNewSession.addEventListener('click', startNewSession);
  dom.btnGoHome.addEventListener('click', goToHomePage);

  // Click student card → that student speaks a question
  dom.studentsStage.addEventListener('click', e => {
    const card = e.target.closest('.student-card');
    if (card?.dataset.student) handleStudentClick(card.dataset.student);
  });

  window.addEventListener('beforeunload', () => recorder.stop());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !dom.topicModal.classList.contains('hidden')) closeTopicModal();
  });
}

/* ── Mic ── */
async function handleMicClick() {
  if (studentIsSpeaking) { showToast('Wait for the student to finish speaking.'); return; }
  if (Date.now() < quotaPauseUntil) {
    showToast(`Quota pause active — try again in ${Math.ceil((quotaPauseUntil - Date.now()) / 1000)}s.`);
    return;
  }
  if (!recorder.isListening) {
    await recorder.start();
    dom.micButton.classList.add('listening');
    dom.levelMeter.classList.add('active');
    return;
  }
  if (recorder.turnActive) { await recorder.forceFinish(); return; }
  recorder.stop();
  dom.micButton.classList.remove('listening', 'processing');
  dom.levelMeter.classList.remove('active');
}

function handleRecorderStatus(status) {
  setStatus(status.title, status.detail, status.mode);
  dom.micButton.classList.toggle('processing', status.mode === 'processing');
  dom.micButton.classList.toggle('listening', recorder.isListening && status.mode !== 'processing');
  dom.levelMeter.classList.toggle('active', status.mode !== 'idle');
}

function handleMeter(meter) {
  const vol  = Math.round(meter.volume * 1000) / 10;
  const gate = Math.round(meter.gate   * 1000) / 10;
  dom.heardLine.textContent = `Mic on · vol ${vol}% · gate ${gate}% · ${meter.label}`;
}

function handleRecorderError(err) {
  setStatus('Microphone could not start', err.message, 'error');
  dom.micButton.classList.remove('listening', 'processing');
  dom.levelMeter.classList.remove('active');
  showToast('Check your browser and Windows microphone permission.');
}

/* ── Teacher turn (Gemini) ── */
async function handleTeacherTurn(turn) {
  const candidate = getRandomStudent();
  try {
    setStudentThinking(candidate.name);
    recorder.mute(true);

    const audioBase64 = await blobToBase64(turn.audioBlob);
    const res = await fetch(API_TURN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64, mimeType: 'audio/wav', topic,
        studentNames:    getStudentNames(),
        studentProfiles: getStudentProfiles(),
        history,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;

    const studentName = normalizeStudentName(data.student, candidate.name);
    if (studentName !== candidate.name) setStudentThinking(studentName);
    dom.heardLine.textContent = `Heard: "${data.transcript}"`;

    addActivity('You', data.transcript);
    addActivity(studentName, data.reply);

    history.push({ teacher: data.transcript, student: studentName, reply: data.reply });
    history = history.slice(-8);
    turnCount++;

    setStatus(`${studentName} is speaking`, data.reply, 'speaking');
    setStudentLeaning(studentName);
    await speakStudent(studentName, data.reply);
    recordStudentSpoke(studentName);
    afterStudentFinished();
  } catch (err) {
    setAllStudentsIdle();
    const msg = err?.message || err?.error || 'Unknown error';

    if (err?.error === 'GEMINI_QUOTA' || /quota|rate limit|429/i.test(msg)) {
      quotaPauseUntil = Date.now() + 90_000;
      dom.heardLine.textContent = `Quota: ${msg}`;
      setStatus('Gemini quota reached', 'Wait a moment or use a new key.', 'error');
      recorder.stop();
      dom.micButton.classList.remove('listening', 'processing');
      dom.levelMeter.classList.remove('active');
      showToast('Gemini quota/rate limit reached.');
      return;
    }
    if (err?.error === 'UNCLEAR_AUDIO' || err?.error === 'NO_AUDIO') {
      setStatus('Could not catch clear words', 'Speak closer to the mic, then pause.', 'listening');
      dom.heardLine.textContent = err.message || 'No clear speech detected.';
      return;
    }
    if (err?.error === 'NO_GEMINI_KEY') {
      setStatus('Gemini key missing', 'Add GEMINI_API_KEY to your .env and restart.', 'error');
      recorder.stop();
      return;
    }
    setStatus('Gemini error', msg, 'error');
    dom.heardLine.textContent = msg;
  } finally {
    recorder.mute(false);
    dom.micButton.classList.remove('processing');
    if (!studentIsSpeaking) setAllStudentsIdle();
  }
}

/* ── Click a student → they ask a question ── */
function handleStudentClick(studentName) {
  if (studentIsSpeaking) { showToast('A student is already speaking.'); return; }
  if (Date.now() < quotaPauseUntil) return;

  const question = pickQuestion();
  addActivity(studentName, question);
  setStatus(`${studentName} has a question`, question, 'speaking');
  speakStudent(studentName, question).then(() => {
    recordStudentSpoke(studentName);
    afterStudentFinished();
  });
}

/* ── Speak student ── */
function speakStudent(studentName, text) {
  return new Promise(resolve => {
    studentIsSpeaking = true;
    recorder.mute(true);
    dom.micButton.classList.add('student-speaking');
    setStudentSpeaking(studentName, text);

    if (!('speechSynthesis' in window)) {
      setTimeout(finish, Math.max(1900, text.length * 45));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const profile   = getStudentByName(studentName);
    utterance.rate   = profile?.voiceRate  ?? 1.0;
    utterance.pitch  = profile?.voicePitch ?? 1.0;
    utterance.volume = 1;

    const voice = pickVoice(studentName, profile?.gender);
    if (voice) utterance.voice = voice;

    let done = false;
    function finish() {
      if (done) return; done = true;
      studentIsSpeaking = false;
      recorder.mute(false);
      dom.micButton.classList.remove('student-speaking');
      clearStudentSpeechBubble(studentName);
      setAllStudentsIdle();
      resolve();
    }

    utterance.onend   = finish;
    utterance.onerror = finish;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    setTimeout(finish, Math.min(10000, Math.max(2500, text.length * 90)));
  });
}

/* ── After a student finishes speaking ── */
function afterStudentFinished() {
  if (recorder.isListening) {
    setStatus('Listening — keep teaching naturally', 'Students react after each pause.', 'listening');
  } else {
    setStatus('Ready — press the microphone', 'Students will listen after you press the mic.', 'ready');
  }
}

/* ── Ask button ── */
function askManualQuestion() {
  if (studentIsSpeaking) { showToast('Wait for the student to finish.'); return; }
  const student  = getRandomStudent();
  const question = pickQuestion();
  addActivity(student.name, question);
  setStatus(`${student.name} has a question`, question, 'speaking');
  speakStudent(student.name, question).then(() => {
    recordStudentSpoke(student.name);
    afterStudentFinished();
  });
}

const GENERIC_QUESTIONS = [
  'Can you give us a real-world example of that?',
  'Could you explain the main idea one more time?',
  'How does this connect to what we learned before?',
  'Is there a simpler way to think about this?',
  'What is the most important thing to remember?',
  'Are there any exceptions to this?',
  'What would happen if we reversed the process?',
  'I think I understand — but can you go over that first part again?',
  'Could you slow down on the last part a little?',
  'How would we use this in real life?',
];

function pickQuestion() {
  const t = topic;
  const TOPIC_QUESTIONS = [
    `Wait — can you explain how that works in ${t}?`,
    `Is what you just said always true for ${t}?`,
    `How do scientists or experts study ${t}?`,
    `What's the hardest part to understand about ${t}?`,
    `Can you draw or show us what you mean?`,
  ];
  const all = [...GENERIC_QUESTIONS, ...TOPIC_QUESTIONS];
  return all[Math.floor(Math.random() * all.length)];
}

/* ── Topic modal ── */
function openTopicModal() {
  dom.topicModalInput.value = topic;
  dom.topicModal.classList.remove('hidden');
  requestAnimationFrame(() => dom.topicModalInput.focus());
}

function closeTopicModal() {
  dom.topicModal.classList.add('hidden');
}

function saveTopicModal() {
  const next = dom.topicModalInput.value.trim().slice(0, 80);
  if (!next) return;
  closeTopicModal();
  topic = next;
  dom.topicLabel.textContent = topic;
  dom.boardTopic.style.opacity = '0';
  setTimeout(() => {
    dom.boardTopic.textContent = topic;
    dom.boardTopic.style.opacity = '';
  }, 310);
  addActivity('System', `Topic changed to: "${escapeHtml(topic)}"`);
}

/* ── End session modal ── */
function openEndModal() {
  recorder.stop();
  dom.micButton.classList.remove('listening', 'processing');
  dom.levelMeter.classList.remove('active');
  setAllStudentsIdle();
  setStatus('Session paused', 'Choose an option below.', 'idle');

  const elapsed = Math.floor((Date.now() - classStartedAt) / 1000);
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;

  dom.endStats.innerHTML = `
    <div class="stat-row"><span>Duration</span><strong>${mins}m ${secs}s</strong></div>
    <div class="stat-row"><span>Your turns</span><strong>${turnCount}</strong></div>
    <div class="stat-row"><span>Topic</span><strong>${escapeHtml(topic)}</strong></div>
    ${uploadedFiles.length ? `<div class="stat-row"><span>Files used</span><strong>${uploadedFiles.length}</strong></div>` : ''}
  `;
  dom.endModal.classList.add('open');
}

function startNewSession() {
  dom.endModal.classList.remove('open');
  recorder.stop();

  const lastTopic = topic;   // capture before reset

  dom.appScreen.classList.add('fade-out');
  setTimeout(() => {
    // Reset session state
    history        = [];
    activityItems  = [];
    dom.activityList.innerHTML = '';
    turnCount      = 0;
    classStartedAt = Date.now();
    dom.appScreen.classList.remove('fade-out', 'fade-in');
    dom.appScreen.classList.add('hidden');
    dom.micButton._bound = false;   // allow classroom to re-bind next time

    showSetup(lastTopic);   // pre-fill with last topic
  }, 380);
}

function goToHomePage() {
  dom.endModal.classList.remove('open');
  recorder.stop();

  dom.appScreen.classList.add('fade-out');
  setTimeout(() => {
    history        = [];
    activityItems  = [];
    dom.activityList.innerHTML = '';
    turnCount      = 0;
    classStartedAt = Date.now();
    dom.appScreen.classList.remove('fade-out', 'fade-in');
    dom.appScreen.classList.add('hidden');
    dom.micButton._bound = false;   // allow classroom to re-bind next login

    dom.setupScreen.classList.add('hidden');
    dom.loginScreen.style.display  = '';
    dom.loginScreen.scrollTop = 0;          // always start landing page from top
    dom.loginScreen.classList.remove('fade-out');
    dom.loginScreen.style.opacity  = '0';
    // Trigger reflow then fade in
    void dom.loginScreen.offsetWidth;
    dom.loginScreen.style.transition = 'opacity 380ms ease';
    dom.loginScreen.style.opacity = '1';
    setTimeout(() => { dom.loginScreen.style.transition = ''; }, 400);
  }, 380);
}

/* ── Status ── */
function setStatus(title, detail, mode) {
  dom.mainStatus.textContent = title;
  dom.subStatus.textContent  = detail;
  dom.statusDot.className    = 'status-dot';
  if (mode) dom.statusDot.classList.add(`status-${mode}`);
}

/* ── Timer ── */
function startTimer() {
  if (startTimer._interval) clearInterval(startTimer._interval);
  classStartedAt = Date.now();
  startTimer._interval = setInterval(() => {
    const s = Math.floor((Date.now() - classStartedAt) / 1000);
    dom.timerText.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
}

/* ── Idle life ── */
function startIdleLife() {
  if (startIdleLife._interval) clearInterval(startIdleLife._interval);
  startIdleLife._interval = setInterval(() => {
    if (!studentIsSpeaking && !recorder.isProcessing) flashRandomStudent();
  }, 3400);
}

/* ── Activity log ── */
function addActivity(who, text) {
  activityItems.unshift({ who, text, time: new Date() });
  activityItems = activityItems.slice(0, 30);
  renderActivity();
}

function renderActivity() {
  dom.activityList.innerHTML = activityItems.map(item => {
    const cls  = item.who === 'System' ? 'activity-system' :
                 item.who === 'You'    ? 'activity-teacher' : 'activity-student';
    const time = item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<article class="activity-item ${cls}">
      <div class="activity-header">
        <strong>${escapeHtml(item.who)}</strong>
        <time>${time}</time>
      </div>
      <p>${escapeHtml(item.text)}</p>
    </article>`;
  }).join('');
}

/* ── Toast ── */
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => dom.toast.classList.remove('show'), 3800);
}

/* ── Name helper ── */
function normalizeStudentName(name, fallback) {
  const safe  = String(name || '').trim();
  const match = STUDENTS.find(s => s.name.toLowerCase() === safe.toLowerCase());
  return match ? match.name : fallback;
}

/* ─────────────────────────────────────────────────
   DECORATIONS
───────────────────────────────────────────────── */
function buildStars(container) {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = 1 + Math.random() * 2.2;
    star.style.cssText = `
      left: ${Math.random() * 100}%;
      top:  ${Math.random() * 100}%;
      width:  ${size}px;
      height: ${size}px;
      --dur:   ${2 + Math.random() * 3}s;
      --delay: ${Math.random() * 4}s;
    `;
    container.appendChild(star);
  }
}

function buildBunting() {
  if (!dom.buntingLine || dom.buntingLine._built) return;
  dom.buntingLine._built = true;
  const COLORS = ['#ef4444','#3b82f6','#f59e0b','#22c55e','#a855f7','#ec4899','#06b6d4','#f97316'];
  for (let i = 0; i < 26; i++) {
    const flag = document.createElement('div');
    flag.className = 'bunting-flag';
    flag.style.borderTopColor = COLORS[i % COLORS.length];
    dom.buntingLine.appendChild(flag);
  }
}

/* ─────────────────────────────────────────────────
   FILE UTILITIES
───────────────────────────────────────────────── */
function formatBytes(bytes) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  return { pdf:'📄', doc:'📝', docx:'📝', txt:'📃',
           ppt:'📊', pptx:'📊', xls:'📊', xlsx:'📊',
           png:'🖼️', jpg:'🖼️', jpeg:'🖼️', webp:'🖼️', gif:'🖼️' }[ext] || '📎';
}

function escapeHtml(v) {
  return String(v).replace(/[&<>'"]/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}

/* ─────────────────────────────────────────────────
   SPEECH SYNTHESIS — pre-load voices
───────────────────────────────────────────────── */
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
