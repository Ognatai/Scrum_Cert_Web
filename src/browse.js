let allQuestions = [];

export function initBrowse(questions, title) {
  allQuestions = questions;

  const h2 = document.querySelector('#browse-screen h2');
  if (h2) h2.textContent = title ?? 'Fragen & Antworten durchsuchen';

  document.getElementById('browse-search').value = '';
  filterBrowse();
}

export function filterBrowse() {
  const term = document.getElementById('browse-search').value.trim().toLowerCase();

  const filtered = allQuestions.filter(q => {
    if (!term) return true;
    const haystack = (q.question + ' ' + q.options.map(o => o.text).join(' ')).toLowerCase();
    return haystack.includes(term);
  });

  document.getElementById('browse-count').textContent =
    `${filtered.length} von ${allQuestions.length} Fragen`;

  const list = document.getElementById('browse-list');
  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--slate);padding:24px 0">Keine Fragen gefunden.</p>';
    return;
  }

  // Group by category
  const groups = {};
  filtered.forEach(q => {
    const cat = q.category || 'Sonstige';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(q);
  });

  Object.keys(groups).sort().forEach(cat => {
    const questions = groups[cat];
    const bodyId = 'browse-body-' + cat.replace(/\W+/g, '-');

    const section = document.createElement('div');
    section.className = 'browse-cat-section';

    const header = document.createElement('div');
    header.className = 'fp-cat-header browse-cat-header';
    header.innerHTML = `
      <span class="fp-cat-name">${cat}</span>
      <span class="fp-cat-count">${questions.length} Frage${questions.length !== 1 ? 'n' : ''}</span>
      <span class="fp-cat-chevron open">&#9660;</span>`;

    const body = document.createElement('div');
    body.id = bodyId;
    body.className = 'browse-cat-body';
    body.innerHTML = questions.map(q => buildCard(q)).join('');

    header.addEventListener('click', () => {
      body.classList.toggle('hidden');
      header.querySelector('.fp-cat-chevron').classList.toggle('open');
    });

    section.appendChild(header);
    section.appendChild(body);
    list.appendChild(section);
  });
}

function buildCard(q) {
  const allOptsHtml = q.options.map((o, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<div class="browse-opt ${o.correct ? 'b-correct' : ''}">
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
    </div>
    <div class="browse-opts">${allOptsHtml}</div>
    ${expHtml}
  </div>`;
}
