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
    description: 'In allen Kategorien mindestens eine Frage beantwortet',
    image: '/achievements/Wissenssammler.jpg',
    check: ({ stats, totalCategories }) => totalCategories > 0 && stats.length >= totalCategories
  },
  {
    id: 'Lernprofi',
    name: 'Lernprofi',
    description: 'Durchschnitt über 80% in den letzten 10 Tests',
    image: '/achievements/Lernprofi.jpg',
    check: ({ history }) => {
      const last10 = history.slice(0, 10);
      if (last10.length < 10) return false;
      const avg = last10.reduce((s, e) => s + Number(e.percentage), 0) / last10.length;
      return avg >= 80;
    }
  },
  {
    id: 'Fortschrittsmacher',
    name: 'Fortschrittsmacher',
    description: 'In 5 verschiedenen Kategorien mindestens 5 Fragen beantwortet',
    image: '/achievements/Fortschritssmacher.jpg',
    check: ({ stats }) => stats.filter(s => Number(s.gesamt) >= 5).length >= 5
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

export function computeAchievements(ctx) {
  return ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(ctx) }));
}

export function renderAchievements(el, achievements) {
  const earned = achievements.filter(a => a.earned).length;
  el.innerHTML = `
    <h3 class="achievements-heading">
      Achievements
      <span class="achievements-count">${earned} / ${achievements.length}</span>
    </h3>
    <div class="achievements-grid">
      ${achievements.map(a => `
        <div class="achievement-card ${a.earned ? 'earned' : 'locked'}" title="${a.description}">
          <div class="achievement-img-wrap">
            <img src="${a.image}" alt="${a.name}" loading="lazy">
            ${!a.earned ? '<div class="achievement-lock">&#128274;</div>' : ''}
          </div>
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
        </div>`).join('')}
    </div>`;
}
