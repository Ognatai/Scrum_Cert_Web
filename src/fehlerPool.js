let poolQuestions = [];
let selectedIds = new Set();

export function initFehlerPool(questions) {
  poolQuestions = questions;
  selectedIds = new Set(questions.map(q => q.id));
  render();
}

export function getSelectedQuestions() {
  return poolQuestions.filter(q => selectedIds.has(q.id));
}

function render() {
  const emptyEl   = document.getElementById('fehlerPool-empty');
  const contentEl = document.getElementById('fehlerPool-content');

  if (!poolQuestions.length) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  updateToolbar();
  renderList();
  updateStartButton();
}

function updateToolbar() {
  document.getElementById('fp-total-label').textContent =
    `${poolQuestions.length} Frage${poolQuestions.length !== 1 ? 'n' : ''} im Pool`;
}

function renderList() {
  // Group by category
  const groups = {};
  poolQuestions.forEach(q => {
    const cat = q.category || 'Sonstige';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(q);
  });

  const list = document.getElementById('fehlerPool-list');
  list.innerHTML = '';

  Object.keys(groups).sort().forEach(cat => {
    const questions = groups[cat];
    const catId = 'fp-cat-' + cat.replace(/\W+/g, '-');
    const bodyId = 'fp-body-' + cat.replace(/\W+/g, '-');

    const block = document.createElement('div');
    block.className = 'fp-cat-block';

    const allSelected = questions.every(q => selectedIds.has(q.id));

    block.innerHTML = `
      <div class="fp-cat-header" id="${catId}" role="button" tabindex="0" aria-expanded="true" aria-controls="${bodyId}">
        <input type="checkbox" class="fp-cat-cb" data-cat="${cat}" onclick="event.stopPropagation()" ${allSelected ? 'checked' : ''}>
        <span class="fp-cat-name">${cat}</span>
        <span class="fp-cat-count">${questions.length} Frage${questions.length !== 1 ? 'n' : ''}</span>
        <span class="fp-cat-chevron open">&#9660;</span>
      </div>
      <div class="fp-question-list" id="${bodyId}" role="region" aria-label="${cat}">
        ${questions.map(q => `
          <label class="fp-question-item">
            <input type="checkbox" class="fp-q-cb" data-id="${q.id}" ${selectedIds.has(q.id) ? 'checked' : ''}>
            <span class="fp-question-text">${q.question}</span>
          </label>
        `).join('')}
      </div>`;

    // Category header collapse toggle
    const headerEl = block.querySelector(`#${catId}`);
    const toggleFpCat = e => {
      if (e.target.type === 'checkbox') return;
      const body = document.getElementById(bodyId);
      const chev = block.querySelector('.fp-cat-chevron');
      const expanded = body.classList.toggle('hidden') === false;
      chev.classList.toggle('open', expanded);
      headerEl.setAttribute('aria-expanded', String(expanded));
    };
    headerEl.addEventListener('click', toggleFpCat);
    headerEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFpCat(e); } });

    // Category checkbox
    block.querySelector('.fp-cat-cb').addEventListener('change', e => {
      questions.forEach(q => {
        if (e.target.checked) selectedIds.add(q.id);
        else selectedIds.delete(q.id);
      });
      block.querySelectorAll('.fp-q-cb').forEach(cb => { cb.checked = e.target.checked; });
      updateStartButton();
    });

    // Individual question checkboxes
    block.querySelectorAll('.fp-q-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedIds.add(cb.dataset.id);
        else selectedIds.delete(cb.dataset.id);
        // Sync category checkbox
        const catCb = block.querySelector('.fp-cat-cb');
        catCb.checked = questions.every(q => selectedIds.has(q.id));
        catCb.indeterminate = !catCb.checked && questions.some(q => selectedIds.has(q.id));
        updateStartButton();
      });
    });

    list.appendChild(block);
  });
}

function updateStartButton() {
  const count = selectedIds.size;
  const btn = document.getElementById('btn-fehlerPool-start');
  btn.disabled = count === 0;
  btn.textContent = count > 0
    ? `Üben starten (${count} Frage${count !== 1 ? 'n' : ''})`
    : 'Üben starten';
}

export function fpSelectAll() {
  selectedIds = new Set(poolQuestions.map(q => q.id));
  document.querySelectorAll('.fp-q-cb, .fp-cat-cb').forEach(cb => {
    cb.checked = true;
    cb.indeterminate = false;
  });
  updateStartButton();
}

export function fpDeselectAll() {
  selectedIds = new Set();
  document.querySelectorAll('.fp-q-cb, .fp-cat-cb').forEach(cb => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  updateStartButton();
}
