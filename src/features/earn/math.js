import { SPIN_COST_ALL } from '../../config/constants.js';
import { WEALTH_TIERS, wealthTierIdx } from '../../config/wealth.js';
import { rnd } from '../../domain/random.js';
import { updateBalances } from '../hud/balance.js';
import { updateAchievements } from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

// EARN
export const EARN_LEVELS = [
  { id: 0, name: 'Легко', mult: 1 },
  { id: 1, name: 'Обычно', mult: 2 },
  { id: 2, name: 'Сложно', mult: 4 },
  { id: 3, name: 'Жёстко', mult: 8 },
];

export function earnReward(){
  const level = EARN_LEVELS[S.earnLevel] || EARN_LEVELS[0];
  return SPIN_COST_ALL * level.mult;
}

function roll(lo, hi){
  return lo + ~~(Math.random() * (hi - lo + 1));
}

function band(lo, hi, rank){
  const grow = 1 + rank * 0.85;
  const a = Math.max(2, Math.round(lo * grow));
  const b = Math.max(a + 2, Math.round(hi * grow));
  return roll(a, b);
}

export function genMathProblem(){
  const rank = wealthTierIdx(S.rub);
  const tier = Math.max(0, Math.min(3, S.earnLevel || 0));
  let a,b,c,answer,text;
  const r = Math.random();
  if(tier === 0){
    if(r < 0.5){ a = band(2, 9, rank); b = band(2, 9, rank); answer = a + b; text = a+' + '+b; }
    else { a = band(8, 20, rank); b = band(1, 7, rank); if(b >= a) b = Math.max(1, a - 1); answer = a - b; text = a+' − '+b; }
  } else if(tier === 1){
    if(r < 0.5){ a = band(2, 6, rank); b = band(2, 6, rank); answer = a * b; text = a+' × '+b; }
    else { a = band(12, 40, rank); b = band(6, 24, rank); answer = a + b; text = a+' + '+b; }
  } else if(tier === 2){
    if(r < 0.34){ a = rnd([10, 20, 25, 40, 50]); b = band(20, 80, rank); answer = Math.round(a * b / 100); text = a+'% от '+b; }
    else if(r < 0.67){ a = band(2, 8, rank); b = band(2, 7, rank); c = band(4, 16, rank); answer = a * b + c; text = a+' × '+b+' + '+c; }
    else { b = band(2, 8, rank); answer = band(3, 12, rank); a = b * answer; text = a+' ÷ '+b; }
  } else if(r < 0.34){
    a = band(4, 12, rank); b = band(2, 18, rank); if(b >= a * a) b = a * a - 1; answer = a * a - b; text = a+'² − '+b;
  } else if(r < 0.67){
    a = band(3, 9, rank); b = band(2, 8, rank); c = band(2, 6, rank); answer = (a + b) * c; text = '('+a+' + '+b+') × '+c;
  } else {
    a = band(6, 16, rank); b = band(2, 8, rank); c = band(2, 7, rank); answer = a * b - c * c; text = a+' × '+b+' − '+c+'²';
  }
  return { text, answer };
}

export function renderEarnProblem(){
  if(flags.earnLocked) return;
  const p = genMathProblem();
  flags.earnProblem = p;
  const probEl = document.getElementById('earnProblem');
  const inpEl = document.getElementById('earnInput');
  const fbEl = document.getElementById('earnFeedback');
  if(!probEl) return;
  probEl.textContent = p.text;
  probEl.classList.remove('pulse'); void probEl.offsetWidth; probEl.classList.add('pulse');
  if(inpEl){ inpEl.value = ''; inpEl.classList.remove('ok','err'); inpEl.focus(); }
  if(fbEl){ fbEl.textContent = ''; fbEl.className = 'earn-feedback'; }
  updateEarnStats();
}

export function updateEarnStats(){
  const rewardNow = earnReward();
  const r = document.getElementById('earnReward'); if(r) r.textContent = rewardNow.toLocaleString('ru-RU')+' ₽';
  document.querySelectorAll('#earnLevel button').forEach(b => b.classList.toggle('active', Number(b.dataset.level) === (S.earnLevel || 0)));
  const rank = document.getElementById('earnRank');
  if(rank) rank.textContent = WEALTH_TIERS[wealthTierIdx(S.rub)].label;
  const so = document.getElementById('earnSolved'); if(so) so.textContent = S.earnSolved||0;
  const wr = document.getElementById('earnWrong'); if(wr) wr.textContent = S.earnWrong||0;
  const st = document.getElementById('earnStreak'); if(st) st.textContent = S.earnStreak||0;
  const be = document.getElementById('earnBest'); if(be) be.textContent = S.earnBest||0;
}

export function submitEarnAnswer(){
  if(flags.earnLocked || !flags.earnProblem) return;
  const inp = document.getElementById('earnInput');
  const fb = document.getElementById('earnFeedback');
  const raw = (inp.value||'').trim();
  if(!raw) return;
  const num = Number(raw);
  if(!isFinite(num)){ fb.className = 'earn-feedback err'; fb.textContent = '❌ Введи число'; Sound.error(); return; }
  if(num === flags.earnProblem.answer){
    const reward = earnReward();
    S.rub += reward; S.totalEarned += reward;
    S.earnSolved++; S.earnStreak++;
    if(S.earnStreak > S.earnBest) S.earnBest = S.earnStreak;
    inp.classList.remove('err'); inp.classList.add('ok');
    fb.className = 'earn-feedback ok';
    fb.textContent = '✅ Верно! +'+reward.toLocaleString('ru-RU')+' ₽';
    Sound.coin(); haptic(15);
    flags.earnLocked = true;
    updateBalances(); updateEarnStats(); updateAchievements(); save();
    setTimeout(() => { flags.earnLocked = false; renderEarnProblem(); }, 900);
  } else {
    S.earnWrong++; S.earnStreak = 0;
    inp.classList.remove('ok'); inp.classList.add('err');
    fb.className = 'earn-feedback err';
    fb.textContent = '❌ Неверно. Ответ: '+flags.earnProblem.answer;
    Sound.error(); haptic([40,60,40]);
    flags.earnLocked = true;
    updateEarnStats(); save();
    setTimeout(() => { flags.earnLocked = false; renderEarnProblem(); }, 1800);
  }
}
