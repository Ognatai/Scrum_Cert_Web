import { supabase, isConfigured } from './supabase.js';
import { getLocalStats, getTotalLocalAnswers, getQuizHistory } from './progress.js';
import { computeAchievements, renderAchievements } from './achievements.js';

export async function getCategoryStats(user) {
  if (isConfigured && user) {
    const { data } = await supabase.rpc('my_category_stats');
    return data ?? [];
  }
  return getLocalStats();
}

export async function renderStats(user, totalCategories = 0) {
  const loadingEl = document.getElementById('stats-loading');
  const contentEl = document.getElementById('stats-content');
  const emptyEl   = document.getElementById('stats-empty');
  const totalEl   = document.getElementById('stats-total');
  const tableEl   = document.getElementById('stats-table');

  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  const [stats, history] = await Promise.all([
    getCategoryStats(user),
    getQuizHistory(user)
  ]);

  loadingEl.classList.add('hidden');

  const totalAnswers = isConfigured && user
    ? (stats ?? []).reduce((s, r) => s + Number(r.gesamt), 0)
    : getTotalLocalAnswers();

  // Kategorien
  if (!stats || stats.length === 0) {
    emptyEl.classList.remove('hidden');
  } else {
    totalEl.textContent = `${totalAnswers} Antworten`;
    tableEl.innerHTML = stats.map(row => {
      const pct = Number(row.prozent);
      return `<div class="stats-row">
        <span class="stats-cat">${row.category}</span>
        <div class="stats-bar-wrap">
          <div class="stats-bar" style="width:${pct}%;background:var(--primary)"></div>
        </div>
        <span class="stats-pct" style="color:var(--primary)">${pct}%</span>
        <span class="stats-count">${row.richtig}/${row.gesamt}</span>
      </div>`;
    }).join('');
    contentEl.classList.remove('hidden');
  }

  // Verlauf
  renderHistory(history);

  // Erfolge
  const achievements = computeAchievements({ history, stats: stats ?? [], totalAnswers, totalCategories });
  renderAchievements(document.getElementById('achievements-section'), achievements);
}

const MODE_LABEL = { normal: 'Normal', timed: 'Zeitlimit', fehlerPool: 'Fehlerpool', favorites: 'Favoriten' };

function renderHistory(history) {
  const loadingEl = document.getElementById('history-loading');
  const listEl    = document.getElementById('history-list');
  const emptyEl   = document.getElementById('history-empty');
  const metaEl    = document.getElementById('history-meta');

  loadingEl.classList.add('hidden');
  listEl.innerHTML = '';
  emptyEl.classList.add('hidden');

  if (!history.length) {
    emptyEl.classList.remove('hidden');
    metaEl.textContent = '';
    return;
  }

  metaEl.textContent = `${history.length} Einträge`;

  listEl.innerHTML = `
    <div class="history-header">
      <span>Datum / Zeit</span>
      <span>Testart</span>
      <span>Ergebnis</span>
      <span>Prozent</span>
    </div>` +
  history.map(entry => {
    const pct       = Number(entry.percentage);
    const date      = new Date(entry.completed_at).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const modeLabel = MODE_LABEL[entry.mode] ?? entry.mode;
    return `
      <div class="history-row">
        <span class="history-date">${date}</span>
        <span class="history-mode">${modeLabel}</span>
        <span class="history-score">${entry.score} / ${entry.total}</span>
        <span class="history-pct" style="color:var(--primary)">${pct}%</span>
      </div>`;
  }).join('');
}
