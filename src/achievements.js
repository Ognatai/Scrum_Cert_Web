const ACHIEVEMENTS = [
  {
    id: '10Tests',
    name: '10 Tests',
    description: '10 Quiz-Runden abgeschlossen',
    image: '/achievements/10Tests.jpg',
    check: ({ history }) => history.length >= 10
  },
  {
    id: '50Tests',
    name: '50 Tests',
    description: '50 Quiz-Runden abgeschlossen',
    image: '/achievements/50Tests.jpg',
    check: ({ history }) => history.length >= 50
  },
  {
    id: 'ErsterTestbestanden',
    name: 'Erster Test bestanden',
    description: 'Einen Test mit mindestens 85% abgeschlossen',
    image: '/achievements/ErsterTestbestanden.jpg',
    check: ({ history }) => history.some(e => Number(e.percentage) >= 85)
  },
  {
    id: 'Erste100',
    name: 'Erste 100%',
    description: 'Einen Test mit 100% bestanden',
    image: '/achievements/Erste100Prozent.jpg',
    check: ({ history }) => history.some(e => Number(e.percentage) === 100)
  },
  {
    id: 'Meilenstein',
    name: 'Meilenstein',
    description: '500 Fragen beantwortet',
    image: '/achievements/Meilenstein.jpg',
    check: ({ totalAnswers }) => totalAnswers >= 500
  },
  {
    id: 'StreakStarter',
    name: 'Streak Starter',
    description: '3 Tage in Folge ein Quiz gemacht',
    image: '/achievements/StreakStarter.jpg',
    check: ({ history }) => getMaxStreak(history) >= 3
  },
  {
    id: 'WocheAktiv',
    name: 'Woche Aktiv',
    description: '7 Tage in Folge ein Quiz gemacht',
    image: '/achievements/WocheAktiv.jpg',
    check: ({ history }) => getMaxStreak(history) >= 7
  },
  {
    id: 'Wissenssammler',
    name: 'Wissenssammler',
    description: '100 Fragen beantwortet',
    image: '/achievements/Wissenssammler.jpg',
    check: ({ totalAnswers }) => totalAnswers >= 100
  },
  {
    id: 'Lernprofi',
    name: 'Lernprofi',
    description: '25 Tests abgeschlossen',
    image: '/achievements/Lernprofi.jpg',
    check: ({ history }) => history.length >= 25
  },
  {
    id: 'Fortschrittsmacher',
    name: 'Fortschrittsmacher',
    description: '20 Tests abgeschlossen',
    image: '/achievements/Fortschritssmacher.jpg',
    check: ({ history }) => history.length >= 20
  }
];

function getMaxStreak(history) {
  if (!history.length) return 0;
  const days = [...new Set(
    history.map(e => new Date(e.completed_at).toDateString())
  )].map(d => new Date(d)).sort((a, b) => b - a);
  let max = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i - 1] - days[i]) / 864e5);
    if (diff === 1) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}

const LS_KEY = 'scrumfit_earned_achievements';

function getStoredEarned() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY)) ?? []); }
  catch { return new Set(); }
}

function saveEarned(ids) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
}

export function computeAchievements(ctx) {
  return ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(ctx) }));
}

export function checkAndNotifyNewAchievements(ctx) {
  const all     = computeAchievements(ctx);
  const stored  = getStoredEarned();
  const newOnes = all.filter(a => a.earned && !stored.has(a.id));

  if (newOnes.length) {
    const updated = new Set([...stored, ...newOnes.map(a => a.id)]);
    saveEarned(updated);
    showAchievementPopups(newOnes);
  }
}

let popupQueue = [];
let popupActive = false;

function showAchievementPopups(list) {
  popupQueue.push(...list);
  if (!popupActive) nextPopup();
}

function nextPopup() {
  if (!popupQueue.length) { popupActive = false; return; }
  popupActive = true;
  const a = popupQueue.shift();

  const el = document.createElement('div');
  el.className = 'achievement-popup';
  el.innerHTML = `
    <div class="achievement-popup-inner">
      <div class="achievement-popup-label">Neuer Erfolg freigeschaltet!</div>
      <img src="${a.image}" alt="${a.name}" class="achievement-popup-img">
      <div class="achievement-popup-name">${a.name}</div>
      <div class="achievement-popup-desc">${a.description}</div>
    </div>`;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('show'));

  const dismiss = () => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => { el.remove(); nextPopup(); }, { once: true });
  };
  el.addEventListener('click', dismiss);
  setTimeout(dismiss, 4000);
}

export function renderAchievements(el, achievements) {
  const earned = achievements.filter(a => a.earned);
  const metaEl = document.getElementById('achievements-meta');
  if (metaEl) metaEl.textContent = earned.length ? `${earned.length} / ${achievements.length}` : '';

  if (!earned.length) {
    el.innerHTML = `<p class="stats-empty" style="margin:0">Noch keine Erfolge freigeschaltet. Starte ein Quiz!</p>`;
    return;
  }
  el.innerHTML = `
    <div class="achievements-grid">
      ${earned.map(a => `
        <div class="achievement-card earned" title="${a.description}">
          <div class="achievement-img-wrap">
            <button class="achievement-img-click" type="button" aria-label="${a.name} vergrößern" data-src="${a.image}" data-name="${a.name}">
              <img src="${a.image}" alt="${a.name}" loading="lazy">
            </button>
          </div>
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
        </div>`).join('')}
    </div>
    <div id="achievement-lightbox" class="achievement-lightbox hidden" role="dialog" aria-modal="true" aria-labelledby="achievement-lightbox-name">
      <div class="achievement-lightbox-backdrop"></div>
      <div class="achievement-lightbox-content">
        <img id="achievement-lightbox-img" src="" alt="">
        <div id="achievement-lightbox-name" class="achievement-lightbox-name"></div>
        <button class="achievement-lightbox-close" id="achievement-lightbox-close" aria-label="Schließen">&#10005;</button>
      </div>
    </div>`;

  el.querySelectorAll('.achievement-img-click').forEach(btn => {
    btn.addEventListener('click', () => openLightbox(btn.dataset.src, btn.dataset.name, btn));
  });
  el.querySelector('#achievement-lightbox-close').addEventListener('click', closeLightbox);
  el.querySelector('.achievement-lightbox-backdrop').addEventListener('click', closeLightbox);
}

let lightboxTrigger = null;
let lightboxTrapHandler = null;

function openLightbox(src, name, triggerEl) {
  lightboxTrigger = triggerEl ?? null;
  const lb = document.getElementById('achievement-lightbox');
  document.getElementById('achievement-lightbox-img').src = src;
  document.getElementById('achievement-lightbox-img').alt = name;
  document.getElementById('achievement-lightbox-name').textContent = name;
  lb.classList.remove('hidden');

  const closeBtn = document.getElementById('achievement-lightbox-close');
  closeBtn.focus();

  lightboxTrapHandler = e => {
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...lb.querySelectorAll('button:not([disabled])')].filter(el => !el.closest('.hidden'));
    if (focusable.length < 2) { e.preventDefault(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  lb.addEventListener('keydown', lightboxTrapHandler);
}

function closeLightbox() {
  const lb = document.getElementById('achievement-lightbox');
  if (!lb) return;
  lb.classList.add('hidden');
  if (lightboxTrapHandler) { lb.removeEventListener('keydown', lightboxTrapHandler); lightboxTrapHandler = null; }
  if (lightboxTrigger) { lightboxTrigger.focus(); lightboxTrigger = null; }
}
