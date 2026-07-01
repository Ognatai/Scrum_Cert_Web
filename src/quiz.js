import { shuffle } from './shuffle.js';
import { recordAnswer, addToFehlerPool, removeFromFehlerPool } from './progress.js';

// 45 seconds per question (total = count × 45)
const SECS_PER_QUESTION = 45;

let state = null;

export function getState() { return state; }

export function initQuiz(questions, mode) {
  // Deduplicate by ID before shuffling
  const seen = new Set();
  const unique = questions.filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });
  const shuffledQ = shuffle(unique);
  state = {
    questions: shuffledQ,
    displayedOptions: shuffledQ.map(q => shuffle(q.options)),
    currentIndex: 0,
    sessionCount: shuffledQ.length,
    score: 0,
    history: [],           // {question, opts, selected: Set<idx>, correct}
    answered: false,
    selectedIndices: new Set(),
    mode,
    timedAnswers: mode === 'timed' ? shuffledQ.map(() => new Set()) : null,
    timeLeft: mode === 'timed' ? shuffledQ.length * SECS_PER_QUESTION : 0,
    timerInterval: null
  };
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderQuestion(user) {
  if (!state) return;
  const { questions, displayedOptions, currentIndex, sessionCount, mode, history } = state;
  const q = questions[currentIndex];
  const opts = displayedOptions[currentIndex];
  const correctCount = opts.filter(o => o.correct).length;
  const isMulti = correctCount > 1;

  // Progress
  document.getElementById('progress-bar').style.width =
    ((currentIndex / sessionCount) * 100) + '%';
  document.getElementById('progress-text').textContent =
    `Frage ${currentIndex + 1} von ${sessionCount}`;

  // Question text
  const qTextEl = document.getElementById('question-text');
  qTextEl.textContent = q.question;
  if (isMulti) {
    const badge = document.createElement('span');
    badge.className = 'multi-hint';
    badge.textContent = `${correctCount} auswählen`;
    qTextEl.appendChild(badge);
  }

  // Options
  const container = document.getElementById('options');
  container.innerHTML = '';
  state.selectedIndices = new Set();
  state.answered = false;

  opts.forEach((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const div = document.createElement('div');
    div.className = 'option';
    div.dataset.idx = i;
    div.innerHTML = `<div class="letter-badge">${letter}</div><div class="option-text">${opt.text}</div>`;
    div.addEventListener('click', () => toggleOption(div, i));
    div.addEventListener('touchend', e => { e.preventDefault(); toggleOption(div, i); });
    container.appendChild(div);
  });

  // Clear feedback
  const fb = document.getElementById('feedback');
  fb.className = 'feedback';
  fb.innerHTML = '';

  document.getElementById('btn-back').disabled = currentIndex === 0;
  const isLast = currentIndex === sessionCount - 1;

  if (mode === 'timed') {
    // Restore previously selected options for this question
    state.selectedIndices = new Set(state.timedAnswers[currentIndex]);
    container.querySelectorAll('.option').forEach(div => {
      if (state.selectedIndices.has(Number(div.dataset.idx))) div.classList.add('selected');
    });
    document.getElementById('btn-submit').style.display = 'none';
    document.getElementById('btn-next').disabled = false;
    document.getElementById('btn-next').textContent = isLast ? 'Quiz beenden' : 'Weiter';
  } else {
    document.getElementById('btn-submit').style.display = '';
    document.getElementById('btn-submit').disabled = true;
    document.getElementById('btn-next').disabled = true;
    document.getElementById('btn-next').textContent = isLast ? 'Ergebnis anzeigen' : 'Weiter';

    // Restore answered state when navigating back
    if (currentIndex < history.length) {
      restoreAnsweredState(q, opts, history[currentIndex]);
    }
  }
}

function restoreAnsweredState(q, opts, entry) {
  state.answered = true;
  state.selectedIndices = new Set(entry.selected);

  document.querySelectorAll('.option').forEach(div => {
    const i = Number(div.dataset.idx);
    div.classList.add('disabled');
    applyOptionStyle(div, opts[i], entry.selected.has(i));
  });

  const fb = document.getElementById('feedback');
  renderFeedback(fb, opts, entry.selected, entry.correct, q.explanation);
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('btn-next').disabled = false;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

function toggleOption(div, index) {
  if (state.answered) return;
  const { displayedOptions, currentIndex, mode } = state;
  const opts = displayedOptions[currentIndex];
  const isMulti = opts.filter(o => o.correct).length > 1;

  if (isMulti) {
    if (state.selectedIndices.has(index)) {
      state.selectedIndices.delete(index);
      div.classList.remove('selected');
    } else {
      state.selectedIndices.add(index);
      div.classList.add('selected');
    }
  } else {
    document.querySelectorAll('.option').forEach(d => d.classList.remove('selected'));
    state.selectedIndices = new Set([index]);
    div.classList.add('selected');
  }

  if (mode === 'timed') {
    state.timedAnswers[state.currentIndex] = new Set(state.selectedIndices);
  } else {
    document.getElementById('btn-submit').disabled = state.selectedIndices.size === 0;
  }
}

export async function submitAnswer(user) {
  if (state.answered) return;
  state.answered = true;

  const { questions, displayedOptions, currentIndex, selectedIndices } = state;
  const q = questions[currentIndex];
  const opts = displayedOptions[currentIndex];
  const isCorrect = checkCorrect(opts, selectedIndices);

  if (isCorrect) state.score++;
  state.history.push({ question: q, opts, selected: new Set(selectedIndices), correct: isCorrect });

  await recordAnswer(user, q, isCorrect);

  if (isCorrect) await removeFromFehlerPool(user, q.id);
  else           await addToFehlerPool(user, q);

  // Apply option styles
  document.querySelectorAll('.option').forEach(div => {
    const i = Number(div.dataset.idx);
    div.classList.add('disabled');
    applyOptionStyle(div, opts[i], selectedIndices.has(i));
  });

  // Show feedback
  const fb = document.getElementById('feedback');
  renderFeedback(fb, opts, selectedIndices, isCorrect, q.explanation);

  document.getElementById('btn-submit').disabled = true;
  document.getElementById('btn-next').disabled = false;
}

export function backQuestion(user) {
  if (!state || state.currentIndex === 0) return;
  state.currentIndex--;
  renderQuestion(user);
}

export function nextQuestion(user) {
  if (!state) return;
  if (state.currentIndex === state.sessionCount - 1) {
    const btn = document.getElementById('btn-next');
    btn.disabled = true;
    if (state.mode === 'timed') finishTimedQuiz(user);
    else showResults();
    return;
  }
  state.currentIndex++;
  renderQuestion(user);
}

// ─── Timer ───────────────────────────────────────────────────────────────────

export function startQuizTimer(user) {
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      stopQuizTimer();
      finishTimedQuiz(user);
    }
  }, 1000);
}

export function stopQuizTimer() {
  if (state?.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('timer');
  const min = Math.floor(state.timeLeft / 60);
  const sec = state.timeLeft % 60;
  el.textContent = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  el.className = 'timer-bar' + (state.timeLeft < 120 ? ' warning' : '');
}

async function finishTimedQuiz(user) {
  if (state.finishing) return;
  state.finishing = true;
  stopQuizTimer();
  const btn = document.getElementById('btn-next');
  btn.disabled = true;
  btn.textContent = 'Wird ausgewertet…';
  document.getElementById('timer').classList.add('hidden');
  state.history = [];
  state.score = 0;

  for (let i = 0; i < state.questions.length; i++) {
    const q = state.questions[i];
    const opts = state.displayedOptions[i];
    const sel = state.timedAnswers[i];
    const isCorrect = checkCorrect(opts, sel);
    if (isCorrect) state.score++;
    state.history.push({ question: q, opts, selected: sel, correct: isCorrect });
    await recordAnswer(user, q, isCorrect);
    if (isCorrect) await removeFromFehlerPool(user, q.id);
    else           await addToFehlerPool(user, q);
  }
  showResults();
}

// ─── Results ─────────────────────────────────────────────────────────────────

function showResults() {
  document.getElementById('quiz-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');

  const { score, history, mode } = state;
  const sessionCount = history.length;
  const pct = Math.round((score / sessionCount) * 100);

  document.dispatchEvent(new CustomEvent('quizResults', {
    detail: { score, total: sessionCount, pct, mode }
  }));
  const color = pct >= 85 ? 'var(--correct)' : pct >= 60 ? 'var(--primary)' : 'var(--wrong)';

  const circle = document.getElementById('score-circle');
  circle.style.borderColor = color;
  const numEl = document.getElementById('score-num');
  numEl.textContent = score;
  numEl.style.color = color;
  document.getElementById('score-total').textContent = `/ ${sessionCount}`;
  document.getElementById('score-pct').textContent = pct + '%';

  const msgs = [
    [85, 'Ausgezeichnet! Du würdest die Prüfung bestehen.'],
    [70, 'Guter Fortschritt! Lerne weiter, um die 85%-Bestehensgrenze zu erreichen.'],
    [50, 'Guter Anfang. Überprüfe die verpassten Fragen und versuche es erneut.'],
    [0,  'Lerne weiter! Lies den Scrum Guide und übe mehr.']
  ];
  document.getElementById('score-msg').textContent =
    msgs.find(([threshold]) => pct >= threshold)[1];

  // Reset review state
  document.getElementById('review-tabs').classList.remove('show');
  document.getElementById('btn-review').textContent = 'Antworten überprüfen';
}

export function toggleReview() {
  const tabsEl = document.getElementById('review-tabs');
  const btn = document.getElementById('btn-review');

  if (tabsEl.classList.contains('show')) {
    tabsEl.classList.remove('show');
    btn.textContent = 'Antworten überprüfen';
    return;
  }

  const { history, mode } = state;
  const correctEntries = history.filter(e => e.correct);
  const wrongEntries   = history.filter(e => !e.correct);

  document.getElementById('tab-all').innerHTML =
    history.map((e, i) => buildReviewCard(e, i, mode)).join('');
  document.getElementById('tab-correct').innerHTML = correctEntries.length
    ? correctEntries.map((e, i) => buildReviewCard(e, i, mode)).join('')
    : "<div class='empty-tab'>Noch keine richtigen Antworten.</div>";
  document.getElementById('tab-wrong').innerHTML = wrongEntries.length
    ? wrongEntries.map((e, i) => buildReviewCard(e, i, mode)).join('')
    : "<div class='empty-tab'>Keine falschen Antworten — perfekte Punktzahl!</div>";

  document.querySelector('[data-tab="all"]').textContent      = `Alle (${history.length})`;
  document.querySelector('[data-tab="correct"]').textContent  = `Richtig (${correctEntries.length})`;
  document.querySelector('[data-tab="wrong"]').textContent    = `Falsch (${wrongEntries.length})`;

  document.getElementById('tab-category').innerHTML = buildCategoryTab(history, mode);

  tabsEl.classList.add('show');
  switchTab('all');
  btn.textContent = 'Überprüfung ausblenden';
}

export function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === 'tab-' + name));
}

function buildReviewCard(entry, i, mode) {
  const { opts, selected } = entry;
  const optsHtml = opts.map((opt, j) => {
    const letter = String.fromCharCode(65 + j);
    const sel = selected.has(j);
    const cor = opt.correct;
    let cls = '';
    if (sel && cor)  cls = 'r-correct';
    else if (sel && !cor) cls = 'r-wrong';
    else if (!sel && cor) cls = 'r-missed';
    return `<div class="review-opt ${cls}">
      <div class="letter-badge">${letter}</div>
      <div class="option-text">${opt.text}</div>
    </div>`;
  }).join('');

  const expHtml = (mode === 'normal' && entry.question.explanation)
    ? `<div class="explanation"><div class="explanation-label">Why?</div>${entry.question.explanation}</div>`
    : '';

  return `<div class="review-card">
    <div class="review-card-q">Q${i + 1}: ${entry.question.question}</div>
    <div class="review-options">${optsHtml}</div>
    ${expHtml}
  </div>`;
}

function buildCategoryTab(history, mode) {
  // Group entries by category
  const groups = {};
  history.forEach((entry, i) => {
    const cat = entry.question.category || 'Sonstige';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ entry, i });
  });

  return Object.keys(groups).sort().map(cat => {
    const items = groups[cat];
    const correct = items.filter(({ entry }) => entry.correct).length;
    const total   = items.length;
    const pct     = Math.round((correct / total) * 100);
    const color   = pct >= 70 ? 'var(--correct)' : pct >= 40 ? 'var(--primary)' : 'var(--wrong)';
    const id      = 'cat-body-' + cat.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

    const cardsHtml = items
      .map(({ entry, i }) => buildReviewCard(entry, i, mode))
      .join('');

    return `
      <div class="cat-group">
        <div class="cat-group-header" onclick="
          const b = document.getElementById('${id}');
          const c = this.querySelector('.cat-group-chevron');
          b.classList.toggle('hidden');
          c.classList.toggle('open');
          this.classList.toggle('collapsed');
        ">
          <span class="cat-group-name">${cat}</span>
          <span class="cat-group-meta">
            <span class="cat-group-score" style="color:${color}">${correct}/${total} (${pct}%)</span>
            <div class="cat-group-bar-wrap">
              <div class="cat-group-bar" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="cat-group-chevron open">&#9660;</span>
          </span>
        </div>
        <div class="cat-group-body" id="${id}">${cardsHtml}</div>
      </div>`;
  }).join('');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function checkCorrect(opts, selectedIndices) {
  const correctIndices = new Set(opts.reduce((acc, o, i) => { if (o.correct) acc.push(i); return acc; }, []));
  if (selectedIndices.size !== correctIndices.size) return false;
  return [...selectedIndices].every(i => correctIndices.has(i));
}

function applyOptionStyle(div, opt, wasSelected) {
  div.classList.remove('selected');
  if (opt.correct && wasSelected)  div.classList.add('correct');
  else if (!opt.correct && wasSelected) div.classList.add('wrong');
  else if (opt.correct && !wasSelected) div.classList.add('missed');
}

function renderFeedback(fb, opts, selectedIndices, isCorrect, explanation) {
  const correctOpts = opts
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.correct);
  const correctLabels = correctOpts
    .map(({ o, i }) => `${String.fromCharCode(65 + i)}) ${o.text}`)
    .join('; ');

  fb.className = 'feedback show ' + (isCorrect ? 'correct-fb' : 'wrong-fb');
  if (isCorrect) {
    fb.innerHTML = '<strong>Richtig!</strong>';
  } else {
    fb.innerHTML = `<strong>Falsch.</strong> Richtige Antwort${correctOpts.length > 1 ? 'en' : ''}: ${correctLabels}`;
  }
  if (explanation) {
    fb.innerHTML += `<div class="explanation"><div class="explanation-label">Warum?</div>${explanation}</div>`;
  }
}
