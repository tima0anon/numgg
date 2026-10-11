import { wealthTierIdx } from '../../config/wealth.js';
import { rnd } from '../../domain/random.js';
import { currentSpinCost } from '../drop/spin.js';
import { updateBalances } from '../hud/balance.js';
import { updateAchievements } from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

// EARN
export function genMathProblem(){
  const tier = wealthTierIdx(S.rub);
  let a,b,c,answer,text;
  const r = Math.random();
  if(tier === 0){
    if(r<0.5){ a=2+~~(Math.random()*18); b=2+~~(Math.random()*18); answer=a+b; text=a+' + '+b; }
    else { a=10+~~(Math.random()*30); b=1+~~(Math.random()*9); answer=a-b; text=a+' − '+b; }
  } else if(tier === 1){
    if(r<0.5){ a=2+~~(Math.random()*8); b=2+~~(Math.random()*8); answer=a*b; text=a+' × '+b; }
    else { a=20+~~(Math.random()*80); b=20+~~(Math.random()*80); answer=a+b; text=a+' + '+b; }
  } else if(tier === 2){
    if(r<0.4){ b=2+~~(Math.random()*8); answer=3+~~(Math.random()*10); a=b*answer; text=a+' ÷ '+b; }
    else if(r<0.7){ a=12+~~(Math.random()*30); b=3+~~(Math.random()*9); answer=a-b; text=a+' − '+b; }
    else { a=2+~~(Math.random()*9); b=2+~~(Math.random()*9); c=5+~~(Math.random()*15); answer=a*b+c; text=a+' × '+b+' + '+c; }
  } else if(tier === 3){
    if(r<0.5){ a=5+~~(Math.random()*20); answer=3+~~(Math.random()*40); b=a+answer; text='x + '+a+' = '+b+'  →  x = ?'; }
    else { a=2+~~(Math.random()*8); answer=3+~~(Math.random()*15); b=a*answer; text=a+'x = '+b+'  →  x = ?'; }
  } else if(tier === 4){
    if(r<0.35){ a=rnd([10,20,25,40,50]); b=10*(2+~~(Math.random()*20)); answer=Math.round(a*b/100); text=a+'% от '+b; }
    else if(r<0.65){ a=100+~~(Math.random()*400); b=20+~~(Math.random()*150); answer=a-b; text=a+' − '+b; }
    else { a=5+~~(Math.random()*15); b=5+~~(Math.random()*15); c=2+~~(Math.random()*9); answer=(a+b)*c; text='('+a+' + '+b+') × '+c; }
  } else if(tier === 5){
    if(r<0.35){ a=6+~~(Math.random()*14); b=2+~~(Math.random()*15); answer=a*a-b; text=a+'² − '+b; }
    else if(r<0.65){ a=7+~~(Math.random()*13); answer=a*a; text='x² = '+answer+'  →  x = ?'; }
    else { a=20+~~(Math.random()*80); b=3+~~(Math.random()*12); c=2+~~(Math.random()*20); answer=a*b-c; text=a+' × '+b+' − '+c; }
  } else if(tier === 6){
    if(r<0.5){ a=12+~~(Math.random()*30); b=4+~~(Math.random()*9); c=3+~~(Math.random()*12); answer=a*b+c*c; text=a+' × '+b+' + '+c+'²'; }
    else { a=3+~~(Math.random()*8); b=5+~~(Math.random()*10); answer=a*(b+a); text=a+' × ('+b+' + '+a+')'; }
  } else {
    if(r<0.5){ a=15+~~(Math.random()*25); b=3+~~(Math.random()*9); c=2+~~(Math.random()*9); answer=a*b-c*c; text=a+' × '+b+' − '+c+'²'; }
    else { a=2+~~(Math.random()*6); b=3+~~(Math.random()*7); c=4+~~(Math.random()*10); answer=(a+b)*(c+a); text='('+a+' + '+b+') × ('+c+' + '+a+')'; }
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
  const r = document.getElementById('earnReward'); if(r) r.textContent = currentSpinCost().toLocaleString('ru-RU')+' ₽';
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
    const reward = currentSpinCost();
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
