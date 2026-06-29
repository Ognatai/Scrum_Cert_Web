import { onAuth, signIn, signUp, signOut } from './auth.js';
import {
  initQuiz, renderQuestion, submitAnswer,
  backQuestion, nextQuestion,
  startQuizTimer, stopQuizTimer,
  toggleReview, switchTab, getState
} from './quiz.js';
import { renderStats } from './stats.js';
import { initBrowse, filterBrowse, toggleBrowseCat } from './browse.js';
import { isConfigured } from './supabase.js';
import { shuffle } from './shuffle.js';

let ALL_QUESTIONS = [];
let currentUser = null;
let selectedCats = new Set();  // category filter on start screen

// ─── Load questions ───────────────────────────────────────────────────────────
async function loadQuestions() {
  const res = await fetch('/questions.json');
  ALL_QUESTIONS = await res.json();
}

// ─── Screen management ───────────────────────────────────────────────────────
function show(id) {
  ['login-screen', 'start-screen', 'quiz-screen', 'browse-screen', 'results-screen', 'stats-screen']
    .forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id));
}

// ─── Start screen: category filter ───────────────────────────────────────────
function buildCategoryFilter() {
  const catCounts = {};
  ALL_QUESTIONS.forEach(q => {
    catCounts[q.category] = (catCounts[q.category] || 0) + 1;
  });

  const grid = document.getElementById('start-cat-filters');
  grid.innerHTML = Object.keys(catCounts).sort().map(cat => `
    <label class="cat-check-item">
      <input type="checkbox" value="${cat}" data-cat="${cat}">
      <span>${cat} <span class="cat-count">(${catCounts[cat]})</span></span>
    </label>`
  ).join('');

  grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const cat = cb.dataset.cat;
      if (cb.checked) selectedCats.add(cat);
      else selectedCats.delete(cat);
      updateStartScreenState();
    });
  });

  // Range inputs: to max
  document.getElementById('range-to').max = ALL_QUESTIONS.length;
  document.getElementById('range-to').value = ALL_QUESTIONS.length;
  document.getElementById('range-from').max = ALL_QUESTIONS.length;
  document.getElementById('total-q-count').textContent = ALL_QUESTIONS.length;
  document.getElementById('count-of-label').textContent = `of ${ALL_QUESTIONS.length}`;
}

function updateStartScreenState() {
  const hasCats = selectedCats.size > 0;
  document.getElementById('range-inputs').classList.toggle('dimmed', hasCats);

  const available = hasCats
    ? ALL_QUESTIONS.filter(q => selectedCats.has(q.category)).length
    : ALL_QUESTIONS.length;

  document.getElementById('count-of-label').textContent = `of ${available}`;
  document.getElementById('filter-hint-cat').textContent =
    hasCats ? `· ${selectedCats.size} selected` : '';
  document.getElementById('range-error').textContent = '';
}

// ─── Filter toggle panels ─────────────────────────────────────────────────────
function toggleFilter(name) {
  const panel  = document.getElementById('filter-panel-' + name);
  const toggle = document.getElementById('filter-toggle-' + name);
  const chev   = document.getElementById('filter-chevron-' + name);
  const open   = panel.classList.toggle('open');
  toggle.classList.toggle('open', open);
  chev.classList.toggle('open', open);
}

// ─── Start quiz ───────────────────────────────────────────────────────────────
function startQuiz(mode) {
  const errEl = document.getElementById('range-error');
  errEl.textContent = '';

  const count = parseInt(document.getElementById('range-count').value, 10);
  if (isNaN(count) || count < 1) {
    errEl.textContent = 'Please enter a valid count.';
    return;
  }

  let pool;
  if (selectedCats.size > 0) {
    pool = ALL_QUESTIONS.filter(q => selectedCats.has(q.category));
    if (pool.length === 0) {
      errEl.textContent = 'No questions found for the selected categories.';
      return;
    }
  } else {
    const from = parseInt(document.getElementById('range-from').value, 10);
    const to   = parseInt(document.getElementById('range-to').value, 10);
    if (isNaN(from) || isNaN(to)) {
      errEl.textContent = 'Please fill in From and To, or select a category.';
      return;
    }
    if (from < 1 || to > ALL_QUESTIONS.length || from > to) {
      errEl.textContent = `Q# must be between 1 and ${ALL_QUESTIONS.length}, and From ≤ To.`;
      return;
    }
    pool = ALL_QUESTIONS.slice(from - 1, to);
  }

  if (count > pool.length) {
    errEl.textContent = `Count must be at most ${pool.length} (available in this selection).`;
    return;
  }

  initQuiz(shuffle(pool).slice(0, count), mode);

  show('quiz-screen');
  const timerEl = document.getElementById('timer');

  if (mode === 'timed') {
    timerEl.classList.remove('hidden');
    startQuizTimer(currentUser);
  } else {
    timerEl.classList.add('hidden');
  }

  renderQuestion(currentUser);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function enterApp(session) {
  currentUser = session?.user ?? null;
  buildCategoryFilter();

  const guestBanner = document.getElementById('guest-banner');
  if (!currentUser) {
    guestBanner.classList.remove('hidden');
  } else {
    guestBanner.classList.add('hidden');
  }
  show('start-screen');
}

// ─── Wire-up ──────────────────────────────────────────────────────────────────
async function init() {
  await loadQuestions();

  // Auth UI
  document.getElementById('show-register').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  });
  document.getElementById('show-login').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  });
  document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.textContent = '';
    const { error } = await signIn(email, password);
    if (error) errEl.textContent = error.message;
  });
  document.getElementById('btn-register').addEventListener('click', async () => {
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const errEl    = document.getElementById('register-error');
    const okEl     = document.getElementById('register-success');
    errEl.textContent = '';
    okEl.textContent  = '';
    const { error } = await signUp(email, password);
    if (error) errEl.textContent = error.message;
    else okEl.textContent = 'Account created! Please confirm your e-mail.';
  });
  document.getElementById('btn-guest').addEventListener('click', () => enterApp(null));

  onAuth(session => { if (session) enterApp(session); });

  // Start screen
  document.getElementById('filter-toggle-cat').addEventListener('click',
    () => toggleFilter('cat'));
  document.getElementById('filter-toggle-range').addEventListener('click',
    () => toggleFilter('range'));
  document.getElementById('btn-start-normal').addEventListener('click',
    () => startQuiz('normal'));
  document.getElementById('btn-start-timed').addEventListener('click',
    () => startQuiz('timed'));
  document.getElementById('btn-show-browse').addEventListener('click', () => {
    initBrowse(ALL_QUESTIONS);
    show('browse-screen');
  });
  document.getElementById('btn-show-stats').addEventListener('click', async () => {
    show('stats-screen');
    await renderStats(currentUser);
  });
  document.getElementById('btn-logout-start').addEventListener('click', async () => {
    await signOut();
    currentUser = null;
    show('login-screen');
  });
  document.getElementById('btn-show-login').addEventListener('click', () => {
    show('login-screen');
  });

  // Quiz screen
  document.getElementById('btn-quiz-home').addEventListener('click', () => {
    if (confirm('Leave the quiz? Your progress will be lost.')) {
      stopQuizTimer();
      show('start-screen');
    }
  });
  document.getElementById('btn-back').addEventListener('click',
    () => backQuestion(currentUser));
  document.getElementById('btn-submit').addEventListener('click',
    () => submitAnswer(currentUser));
  document.getElementById('btn-next').addEventListener('click',
    () => nextQuestion(currentUser));

  // Results screen
  document.getElementById('btn-review').addEventListener('click', toggleReview);
  document.getElementById('btn-new-quiz').addEventListener('click', () => {
    stopQuizTimer();
    show('start-screen');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Browse screen
  document.getElementById('btn-browse-back').addEventListener('click',
    () => show('start-screen'));
  document.getElementById('browse-search').addEventListener('input', filterBrowse);
  document.getElementById('browse-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') filterBrowse();
  });
  document.getElementById('btn-browse-search').addEventListener('click', filterBrowse);

  // Stats screen
  document.getElementById('btn-stats-back').addEventListener('click',
    () => show('start-screen'));
}

init();
