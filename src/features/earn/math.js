import { SPIN_COST_ALL } from '../../config/constants.js';
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

export function genMathProblem(){
  const tier = Math.max(0, Math.min(3, S.earnLevel || 0));
  let a,b,c,answer,text;
  const r = Math.random();
  if(tier === 0){
    if(r<0.5){ a=2+~~(Math.random()*18); b=2+~~(Math.random()*18); answer=a+b; text=a+' + '+b; }
    else { a=10+~~(Math.random()*30); b=1+~~(Math.random()*9); answer=a-b; text=a+' − '+b; }
  } else if(tier === 1){
    if(r<0.5){ a=2+~~(Math.random()*8); b=2+~~(Math.random()*8); answer=a*b; text=a+' × '+b; }
    else { a=20+~~(Math.random()*80); b=20+~~(Math.random()*80); answer=a+b; text=a+' + '+b; }
  } else if(tier === 2){
    if(r<0.34){ a=rnd([10,20,25,40,50]); b=10*(2+~~(Math.random()*20)); answer=Math.round(a*b/100); text=a+'% от '+b; }
    else if(r<0.67){ a=2+~~(Math.random()*9); b=2+~~(Math.random()*9); c=5+~~(Math.random()*15); answer=a*b+c; text=a+' × '+b+' + '+c; }
    else { b=2+~~(Math.random()*8); answer=3+~~(Math.random()*12); a=b*answer; text=a+' ÷ '+b; }
  } else {
    if(r<0.34){ a=6+~~(Math.random()*14); b=2+~~(Math.random()*15); answer=a*a-b; text=a+'² − '+b; }
    else if(r<0.67){ a=4+~~(Math.random()*8); b=3+~~(Math.random()*8); c=2+~~(Math.random()*6); answer=(a+b)*c; text='('+a+' + '+b+') × '+c; }
    else { a=12+~~(Math.random()*20); b=3+~~(Math.random()*8); c=2+~~(Math.random()*6); answer=a*b-c*c; text=a+' × '+b+' − '+c+'²'; }
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
