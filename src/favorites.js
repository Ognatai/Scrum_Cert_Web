let favQuestions = [];

export function initFavorites(questions) {
  favQuestions = questions;

  const listEl    = document.getElementById('favorites-list');
  const emptyEl   = document.getElementById('favorites-empty');
  const contentEl = document.getElementById('favorites-content');
  const countEl   = document.getElementById('fav-count-label');

  if (!questions.length) {
    contentEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
  countEl.textContent = `${questions.length} Frage${questions.length !== 1 ? 'n' : ''} gespeichert`;

  const byCategory = {};
  questions.forEach(q => {
    if (!byCategory[q.category]) byCategory[q.category] = [];
    byCategory[q.category].push(q);
  });

  listEl.innerHTML = Object.keys(byCategory).sort().map(cat => `
    <div class="fav-category">
      <div class="fav-cat-header">${cat} <span class="cat-count">(${byCategory[cat].length})</span></div>
      ${byCategory[cat].map(q => `
        <div class="fav-item">
          <span class="fav-item-text">${q.question}</span>
          <button class="btn-star active fav-remove" data-id="${q.id}" aria-label="Aus Favoriten entfernen" title="Aus Favoriten entfernen">★</button>
        </div>`).join('')}
    </div>`).join('');
}

export function getFavQuestions() {
  return favQuestions;
}
