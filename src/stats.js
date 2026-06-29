import { supabase, isConfigured } from './supabase.js';
import { getLocalStats, getTotalLocalAnswers } from './progress.js';

export async function getCategoryStats(user) {
  if (isConfigured && user) {
    const { data } = await supabase.rpc('my_category_stats');
    return data ?? [];
  }
  return getLocalStats();
}

export async function renderStats(user) {
  const loadingEl = document.getElementById('stats-loading');
  const contentEl = document.getElementById('stats-content');
  const emptyEl   = document.getElementById('stats-empty');
  const totalEl   = document.getElementById('stats-total');
  const tableEl   = document.getElementById('stats-table');

  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  const stats = await getCategoryStats(user);

  loadingEl.classList.add('hidden');

  if (!stats || stats.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  const total = isConfigured && user
    ? stats.reduce((s, r) => s + Number(r.gesamt), 0)
    : getTotalLocalAnswers();

  totalEl.textContent = `${total} answers recorded`;

  tableEl.innerHTML = stats.map(row => {
    const pct = Number(row.prozent);
    const barColor = pct >= 70 ? 'var(--correct)' : pct >= 50 ? 'var(--primary)' : 'var(--wrong)';
    return `<div class="stats-row">
      <span class="stats-cat">${row.category}</span>
      <div class="stats-bar-wrap">
        <div class="stats-bar" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <span class="stats-pct" style="color:${barColor}">${pct}%</span>
      <span class="stats-count">${row.richtig}/${row.gesamt}</span>
    </div>`;
  }).join('');

  contentEl.classList.remove('hidden');
}
