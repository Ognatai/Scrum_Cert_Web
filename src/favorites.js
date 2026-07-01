let favQuestions = [];
let selectedIds = new Set();

export function initFavorites(questions) {
  favQuestions = questions;
  selectedIds = new Set(questions.map(q => q.id));
  render();
}

export function getFavSelectedQuestions() {
  return favQuestions.filter(q => selectedIds.has(q.id));
}

export function favSelectAll() {
  selectedIds = new Set(favQuestions.map(q => q.id));
  document.querySelectorAll('.fav-q-cb, .fav-cat-cb').forEach(cb => {
    cb.checked = true;
    cb.indeterminate = false;
  });
  updateStartButton();
}

export function favDeselectAll() {
  selectedIds = new Set();
  document.querySelectorAll('.fav-q-cb, .fav-cat-cb').forEach(cb => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  updateStartButton();
}

function render() {
  const emptyEl   = document.getElementById('favorites-empty');
  const contentEl = document.getElementById('favorites-content');

  if (!favQuestions.length) {
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
  document.getElementById('fav-total-label').textContent =
    `${favQuestions.length} Frage${favQuestions.length !== 1 ? 'n' : ''} als Favorit`;
}

function renderList() {
  const groups = {};
  favQuestions.forEach(q => {
    const cat = q.category || 'Sonstige';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(q);
  });

  const list = document.getElementById('favorites-list');
  list.innerHTML = '';

  Object.keys(groups).sort().forEach(cat => {
    const questions = groups[cat];
    const catId  = 'fav-cat-'  + cat.replace(/\W+/g, '-');
    const bodyId = 'fav-body-' + cat.replace(/\W+/g, '-');

    const block = document.createElement('div');
    block.className = 'fp-cat-block';

    const allSelected = questions.every(q => selectedIds.has(q.id));

    block.innerHTML = `
      <div class="fp-cat-header" id="${catId}">
        <label onclick="event.stopPropagation()">
          <input type="checkbox" class="fav-cat-cb" data-cat="${cat}" ${allSelected ? 'checked' : ''}>
          ${cat}
        </label>
        <span class="fp-cat-count">${questions.length} Frage${questions.length !== 1 ? 'n' : ''}</span>
        <span class="fp-cat-chevron open">&#9660;</span>
      </div>
      <div class="fp-question-list" id="${bodyId}">
        ${questions.map(q => `
          <div class="fav-question-row">
            <label class="fp-question-item fav-question-label">
              <input type="checkbox" class="fav-q-cb" data-id="${q.id}" ${selectedIds.has(q.id) ? 'checked' : ''}>
              <span class="fp-question-text">${q.question}</span>
            </label>
            <button class="btn-star active fav-remove" data-id="${q.id}" title="Aus Favoriten entfernen">★</button>
          </div>`).join('')}
      </div>`;

    block.querySelector(`#${catId}`).addEventListener('click', e => {
      if (e.target.type === 'checkbox') return;
      const body = document.getElementById(bodyId);
      const chev = block.querySelector('.fp-cat-chevron');
      body.classList.toggle('hidden');
      chev.classList.toggle('open');
    });

    block.querySelector('.fav-cat-cb').addEventListener('change', e => {
      questions.forEach(q => {
        if (e.target.checked) selectedIds.add(q.id);
        else selectedIds.delete(q.id);
      });
      block.querySelectorAll('.fav-q-cb').forEach(cb => { cb.checked = e.target.checked; });
      updateStartButton();
    });

    block.querySelectorAll('.fav-q-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedIds.add(cb.dataset.id);
        else selectedIds.delete(cb.dataset.id);
        const catCb = block.querySelector('.fav-cat-cb');
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
  const btn = document.getElementById('btn-favorites-start');
  btn.disabled = count === 0;
  btn.textContent = count > 0
    ? `Quiz starten (${count} Frage${count !== 1 ? 'n' : ''})`
    : 'Quiz starten';
}
