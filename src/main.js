import { onAuth, signIn, signUp, signOut, deleteAccount } from './auth.js';
import {
  initQuiz, renderQuestion, submitAnswer,
  backQuestion, nextQuestion,
  startQuizTimer, stopQuizTimer,
  toggleReview, switchTab, getState,
  setFavIds, toggleCurrentFavorite
} from './quiz.js';
import { renderStats } from './stats.js';
import { initBrowse, filterBrowse } from './browse.js';
import { isConfigured } from './supabase.js';
import { shuffle } from './shuffle.js';
import { mountLegal } from './legal.js';
import { getFehlerPool, getFehlerPoolCount, recordQuizResult, getFavoriteIds, removeFromFavorites } from './progress.js';
import { initFehlerPool, getSelectedQuestions, fpSelectAll, fpDeselectAll } from './fehlerPool.js';
import { initFavorites, getFavSelectedQuestions, favSelectAll, favDeselectAll } from './favorites.js';

let ALL_QUESTIONS = [];
let currentUser = null;
let selectedCats = new Set();
let inApp = false;
let quizOrigin = 'start'; // 'start' | 'fehlerPool' | 'favorites'
let favIds = new Set();

// ─── Load questions ───────────────────────────────────────────────────────────
async function loadQuestions() {
  const res = await fetch('/questions.json');
  ALL_QUESTIONS = await res.json();
}

// ─── Screen management ───────────────────────────────────────────────────────
function show(id) {
  ['login-screen', 'start-screen', 'quiz-screen', 'browse-screen', 'results-screen', 'stats-screen', 'fehlerPool-screen', 'favorites-screen']
    .forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id));
  window.scrollTo({ top: 0, behavior: 'instant' });
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
  document.getElementById('count-of-label').textContent = `von ${ALL_QUESTIONS.length}`;
}

function updateStartScreenState() {
  const hasCats = selectedCats.size > 0;
  document.getElementById('range-inputs').classList.toggle('dimmed', hasCats);

  const available = hasCats
    ? ALL_QUESTIONS.filter(q => selectedCats.has(q.category)).length
    : ALL_QUESTIONS.length;

  document.getElementById('count-of-label').textContent = `von ${available}`;
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
  quizOrigin = 'start';
  const errEl = document.getElementById('range-error');
  errEl.textContent = '';

  const count = parseInt(document.getElementById('range-count').value, 10);
  if (isNaN(count) || count < 1) {
    errEl.textContent = 'Bitte gib eine gültige Anzahl ein.';
    return;
  }

  let pool;
  if (selectedCats.size > 0) {
    pool = ALL_QUESTIONS.filter(q => selectedCats.has(q.category));
    if (pool.length === 0) {
      errEl.textContent = 'Keine Fragen für die ausgewählten Kategorien gefunden.';
      return;
    }
  } else {
    const from = parseInt(document.getElementById('range-from').value, 10);
    const to   = parseInt(document.getElementById('range-to').value, 10);
    if (isNaN(from) || isNaN(to)) {
      errEl.textContent = 'Bitte Von und Bis ausfüllen oder eine Kategorie auswählen.';
      return;
    }
    if (from < 1 || to > ALL_QUESTIONS.length || from > to) {
      errEl.textContent = `F# muss zwischen 1 und ${ALL_QUESTIONS.length} liegen, und Von ≤ Bis.`;
      return;
    }
    pool = ALL_QUESTIONS.slice(from - 1, to);
  }

  if (count > pool.length) {
    errEl.textContent = `Anzahl darf maximal ${pool.length} sein (in dieser Auswahl verfügbar).`;
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
async function updateFehlerPoolButton() {
  const count = await getFehlerPoolCount(currentUser);
  document.getElementById('fehler-count-badge').textContent = count;
}

async function enterApp(session) {
  inApp = true;
  currentUser = session?.user ?? null;
  buildCategoryFilter();
  updateFehlerPoolButton();

  document.getElementById('btn-account').style.display         = currentUser ? '' : 'none';
  document.getElementById('btn-show-stats').style.display      = currentUser ? '' : 'none';
  document.getElementById('btn-open-favorites').style.display  = currentUser ? '' : 'none';
  document.getElementById('btn-star').style.display            = currentUser ? '' : 'none';

  if (currentUser) {
    favIds = await getFavoriteIds(currentUser);
    setFavIds(new Set(favIds));
  }

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

  onAuth((session, event) => {
    if (event === 'SIGNED_OUT') {
      inApp = false;
      show('login-screen');
      return;
    }
    if (inApp) return; // Already in app — ignore all background auth events
    if (session) enterApp(session);
  });

  // Start screen
  document.getElementById('filter-toggle-cat').addEventListener('click',
    () => toggleFilter('cat'));
  document.getElementById('filter-toggle-range').addEventListener('click',
    () => toggleFilter('range'));
  document.getElementById('btn-start-normal').addEventListener('click',
    () => startQuiz('normal'));
  document.getElementById('btn-start-timed').addEventListener('click',
    () => startQuiz('timed'));
  document.getElementById('btn-open-fehlerPool').addEventListener('click', async () => {
    const pool = await getFehlerPool(currentUser);
    initFehlerPool(pool);
    show('fehlerPool-screen');
  });
  document.getElementById('btn-fehlerPool-back').addEventListener('click',
    () => show('start-screen'));
  document.getElementById('btn-fp-select-all').addEventListener('click', fpSelectAll);
  document.getElementById('btn-fp-deselect-all').addEventListener('click', fpDeselectAll);
  document.getElementById('btn-fehlerPool-start').addEventListener('click', () => {
    const selected = getSelectedQuestions();
    if (!selected.length) return;
    quizOrigin = 'fehlerPool';
    initQuiz(shuffle(selected), 'normal');
    renderQuestion(currentUser);
    show('quiz-screen');
  });
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
    inApp = false;
    currentUser = null;
    show('login-screen');
  });
  document.getElementById('btn-show-login').addEventListener('click', () => {
    show('login-screen');
  });

  // Star / Favoriten
  document.getElementById('btn-star').addEventListener('click', async () => {
    if (!currentUser) return;
    const updatedIds = await toggleCurrentFavorite(currentUser);
    if (updatedIds) favIds = updatedIds;
  });
  document.getElementById('btn-open-favorites').addEventListener('click', async () => {
    const favQs = ALL_QUESTIONS.filter(q => favIds.has(q.id));
    initFavorites(favQs);
    show('favorites-screen');
  });
  document.getElementById('btn-favorites-back').addEventListener('click',
    () => show('start-screen'));
  document.getElementById('btn-fav-select-all').addEventListener('click', favSelectAll);
  document.getElementById('btn-fav-deselect-all').addEventListener('click', favDeselectAll);
  document.getElementById('btn-favorites-start').addEventListener('click', () => {
    const questions = getFavSelectedQuestions();
    if (!questions.length) return;
    quizOrigin = 'favorites';
    initQuiz(shuffle(questions), 'normal');
    renderQuestion(currentUser);
    show('quiz-screen');
  });
  document.getElementById('favorites-list').addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.fav-remove');
    if (!removeBtn || !currentUser) return;
    const qId = removeBtn.dataset.id;
    await removeFromFavorites(currentUser, qId);
    favIds.delete(qId);
    setFavIds(new Set(favIds));
    const favQs = ALL_QUESTIONS.filter(q => favIds.has(q.id));
    initFavorites(favQs);
  });

  // Quiz screen
  document.getElementById('btn-quiz-home').addEventListener('click', () => {
    if (confirm('Quiz verlassen? Dein Fortschritt geht verloren.')) {
      stopQuizTimer();
      updateFehlerPoolButton();
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
    updateFehlerPoolButton();
    show('start-screen');
  });
  document.addEventListener('quizResults', async (e) => {
    document.getElementById('btn-back-to-fehlerPool')
      .classList.toggle('hidden', quizOrigin !== 'fehlerPool');
    document.getElementById('btn-back-to-favorites')
      .classList.toggle('hidden', quizOrigin !== 'favorites');
    const { score, total, pct, mode } = e.detail;
    const label = quizOrigin === 'fehlerPool' ? 'fehlerPool'
                : quizOrigin === 'favorites'  ? 'favorites'
                : mode;
    await recordQuizResult(currentUser, score, total, pct, label);
  });
  document.getElementById('btn-back-to-fehlerPool').addEventListener('click', async () => {
    const pool = await getFehlerPool(currentUser);
    initFehlerPool(pool);
    updateFehlerPoolButton();
    show('fehlerPool-screen');
  });
  document.getElementById('btn-back-to-favorites').addEventListener('click', () => {
    const favQs = ALL_QUESTIONS.filter(q => favIds.has(q.id));
    initFavorites(favQs);
    show('favorites-screen');
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

  // Impressum modal
  const impressumOverlay = document.getElementById('impressum-overlay');
  document.getElementById('btn-impressum').addEventListener('click', () => {
    mountLegal(document.getElementById('impressum-content'), 'impressum');
    impressumOverlay.classList.remove('hidden');
  });
  document.getElementById('btn-close-impressum').addEventListener('click',
    () => impressumOverlay.classList.add('hidden'));
  impressumOverlay.addEventListener('click', e => {
    if (e.target === impressumOverlay) impressumOverlay.classList.add('hidden');
  });

  // Datenschutz modal
  const datenschutzOverlay = document.getElementById('datenschutz-overlay');
  document.getElementById('btn-datenschutz').addEventListener('click', () => {
    mountLegal(document.getElementById('datenschutz-content'), 'datenschutz');
    datenschutzOverlay.classList.remove('hidden');
  });
  document.getElementById('btn-close-datenschutz').addEventListener('click',
    () => datenschutzOverlay.classList.add('hidden'));
  datenschutzOverlay.addEventListener('click', e => {
    if (e.target === datenschutzOverlay) datenschutzOverlay.classList.add('hidden');
  });

  // Account modal
  const accountOverlay = document.getElementById('account-overlay');
  document.getElementById('btn-account').addEventListener('click', () => {
    document.getElementById('account-email').textContent   = currentUser?.email ?? '–';
    const created = currentUser?.created_at
      ? new Date(currentUser.created_at).toLocaleDateString('de-DE')
      : '–';
    document.getElementById('account-created').textContent = created;
    accountOverlay.classList.remove('hidden');
  });
  document.getElementById('btn-close-account').addEventListener('click',
    () => accountOverlay.classList.add('hidden'));
  accountOverlay.addEventListener('click', e => {
    if (e.target === accountOverlay) accountOverlay.classList.add('hidden');
  });
  document.getElementById('btn-delete-account').addEventListener('click', async () => {
    const confirmed = confirm(
      'Account wirklich dauerhaft löschen?\n\nAlle deine Daten (Statistiken, Fehlerpool) werden unwiderruflich gelöscht.'
    );
    if (!confirmed) return;
    const btn = document.getElementById('btn-delete-account');
    btn.disabled = true;
    btn.textContent = 'Wird gelöscht…';
    const { error } = await deleteAccount();
    if (error) {
      alert('Fehler beim Löschen: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Account dauerhaft löschen';
      return;
    }
    accountOverlay.classList.add('hidden');
    inApp = false;
    currentUser = null;
    show('login-screen');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      impressumOverlay.classList.add('hidden');
      datenschutzOverlay.classList.add('hidden');
      accountOverlay.classList.add('hidden');
    }
  });

  // Scroll-to-top button
  const scrollTopBtn = document.getElementById('btn-scroll-top');
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('hidden', window.scrollY < 300);
  }, { passive: true });
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

init();
