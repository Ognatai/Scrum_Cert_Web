import { supabase, isConfigured } from './supabase.js';

const LS_KEY = 'psm_answers';

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function saveLocal(answers) {
  localStorage.setItem(LS_KEY, JSON.stringify(answers));
}

export async function recordAnswer(user, question, correct) {
  if (isConfigured && user) {
    await supabase.from('answers').insert({
      user_id: user.id,
      question_id: question.id,
      category: question.category,
      correct
    });
    return;
  }
  const local = loadLocal();
  local.push({
    question_id: question.id,
    category: question.category,
    correct,
    answered_at: new Date().toISOString()
  });
  saveLocal(local);
}

export async function saveProgress(user, quizId, lastQuestion) {
  if (isConfigured && user) {
    await supabase.from('progress').upsert({
      user_id: user.id,
      quiz_id: quizId,
      last_question: lastQuestion
    });
  }
}

export async function loadProgress(user, quizId) {
  if (isConfigured && user) {
    const { data } = await supabase
      .from('progress')
      .select('last_question')
      .eq('quiz_id', quizId)
      .maybeSingle();
    return data?.last_question ?? 0;
  }
  return 0;
}

export function getLocalStats() {
  const answers = loadLocal();
  const map = {};
  for (const a of answers) {
    if (!map[a.category]) map[a.category] = { gesamt: 0, richtig: 0 };
    map[a.category].gesamt++;
    if (a.correct) map[a.category].richtig++;
  }
  return Object.entries(map).map(([category, { gesamt, richtig }]) => ({
    category,
    gesamt,
    richtig,
    prozent: Math.round((richtig / gesamt) * 100)
  })).sort((a, b) => a.prozent - b.prozent);
}

export function getTotalLocalAnswers() {
  return loadLocal().length;
}

// ─── Fehlerpool ──────────────────────────────────────────────────────────────

const POOL_KEY = 'scrumfit_fehlerPool';

function loadPool() {
  try { return JSON.parse(localStorage.getItem(POOL_KEY) || '[]'); } catch { return []; }
}

function savePool(pool) {
  localStorage.setItem(POOL_KEY, JSON.stringify(pool));
}

export async function addToFehlerPool(user, question) {
  if (isConfigured && user) {
    await supabase.from('mistake_pool').upsert(
      { user_id: user.id, question_id: question.id, question_data: question },
      { onConflict: 'user_id,question_id' }
    );
    return;
  }
  const pool = loadPool();
  if (!pool.some(q => q.id === question.id)) {
    pool.push(question);
    savePool(pool);
  }
}

export async function removeFromFehlerPool(user, questionId) {
  if (isConfigured && user) {
    await supabase.from('mistake_pool')
      .delete()
      .eq('user_id', user.id)
      .eq('question_id', questionId);
    return;
  }
  savePool(loadPool().filter(q => q.id !== questionId));
}

export async function getFehlerPool(user) {
  if (isConfigured && user) {
    const { data } = await supabase.from('mistake_pool')
      .select('question_data')
      .eq('user_id', user.id);
    return (data ?? []).map(r => r.question_data);
  }
  return loadPool();
}

export async function getFehlerPoolCount(user) {
  if (isConfigured && user) {
    const { count } = await supabase.from('mistake_pool')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    return count ?? 0;
  }
  return loadPool().length;
}
