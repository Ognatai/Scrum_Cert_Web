import { shuffle } from './shuffle.js';

let allQuestions = [];
let browseCategories = new Set();

export function initBrowse(questions) {
  allQuestions = questions;
  browseCategories = new Set();

  // Build category checkboxes
  const catCounts = {};
  questions.forEach(q => { catCounts[q.category] = (catCounts[q.category] || 0) + 1; });

  const grid = document.getElementById('browse-cat-filters');
  grid.innerHTML = Object.keys(catCounts).sort().map(cat => `
    <label class="cat-check-item">
      <input type="checkbox" value="${cat}" data-cat="${cat}">
      <span>${cat} <span class="cat-count">(${catCounts[cat]})</span></span>
    </label>`
  ).join('');

  grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => toggleBrowseCat(cb));
  });

  // Filter toggle for browse
  const toggle = document.getElementById('filter-toggle-browse-cat');
  const panel  = document.getElementById('filter-panel-browse-cat');
  const chev   = document.getElementById('filter-chevron-browse-cat');
  toggle.onclick = () => {
    const open = panel.classList.toggle('open');
    toggle.classList.toggle('open', open);
    chev.classList.toggle('open', open);
  };

  document.getElementById('browse-search').value = '';
  filterBrowse();
}

export function toggleBrowseCat(cb) {
  const cat = cb.dataset.cat;
  if (cb.checked) browseCategories.add(cat);
  else browseCategories.delete(cat);

  const n = browseCategories.size;
  document.getElementById('filter-hint-browse-cat').textContent =
    n > 0 ? `· ${n} selected` : '';
  filterBrowse();
}

export function filterBrowse() {
  const term = document.getElementById('browse-search').value.trim().toLowerCase();
  const filtered = allQuestions.filter(q => {
    const matchCat = browseCategories.size === 0 || browseCategories.has(q.category);
    if (!matchCat) return false;
    if (!term) return true;
    const haystack = (q.question + ' ' + q.options.map(o => o.text).join(' ')).toLowerCase();
    return haystack.includes(term);
  });

  document.getElementById('browse-count').textContent =
    `Showing ${filtered.length} of ${allQuestions.length} questions`;

  document.getElementById('browse-list').innerHTML = filtered.map(q => {
    const correctOpts = q.options
      .map((o, i) => ({ o, letter: String.fromCharCode(65 + i) }))
      .filter(({ o }) => o.correct);

    const correctOptsHtml = correctOpts.map(({ o, letter }) => `
      <div class="browse-opt b-correct">
        <div class="letter-badge">${letter}</div>
        <div class="option-text">${o.text}</div>
      </div>`).join('');

    // Show all options (dimmed for wrong, highlighted for correct)
    const allOptsHtml = q.options.map((o, i) => {
      const letter = String.fromCharCode(65 + i);
      const cls = o.correct ? 'b-correct' : '';
      return `<div class="browse-opt ${cls}">
        <div class="letter-badge">${letter}</div>
        <div class="option-text">${o.text}</div>
      </div>`;
    }).join('');

    const expHtml = q.explanation
      ? `<div class="explanation" style="margin-top:10px">
           <div class="explanation-label">Why?</div>${q.explanation}
         </div>`
      : '';

    return `<div class="browse-card">
      <div class="browse-card-top">
        <div class="browse-card-q">${q.question}</div>
        <div class="cat-tag">${q.category || ''}</div>
      </div>
      <div class="browse-opts">${allOptsHtml}</div>
      ${expHtml}
    </div>`;
  }).join('');
}
