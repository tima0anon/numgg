import { updateAcctUI } from '../accountant/view.js';
import {
  cooldownMs,
  updateCd,
  updateDropCostsUI,
} from '../drop/spin.js';
import { updateEarnStats } from '../earn/math.js';
import { updateDailyUI } from '../progress/daily.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

export function animateRubTo(target){
  const el = document.getElementById('rub'); if(!el) return;
  const from = (flags.lastShownRub === null) ? target : flags.lastShownRub;
  if(from === target){ el.textContent = target.toLocaleString('ru-RU'); flags.lastShownRub = target; return; }
  const pill = document.getElementById('balancePill');
  if(pill){ const num = pill.querySelector('.num'); num.classList.remove('flash-up','flash-down'); void pill.offsetWidth; num.classList.add(target > from ? 'flash-up' : 'flash-down'); setTimeout(() => num.classList.remove('flash-up','flash-down'), 350); }
  if(flags.rubAnim) cancelAnimationFrame(flags.rubAnim);
  const start = performance.now(); const dur = 380; const diff = target - from;
  function step(now){
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + diff*eased).toLocaleString('ru-RU');
    if(t < 1) flags.rubAnim = requestAnimationFrame(step);
    else { flags.lastShownRub = target; flags.rubAnim = null; }
  }
  flags.rubAnim = requestAnimationFrame(step);
}

export function updateBalances(){
  animateRubTo(S.rub);
  document.getElementById('cdVal').textContent = (cooldownMs()/1000).toFixed(1);
  document.getElementById('cdLvl').textContent = S.cdLvl;
  const cdCost = 200 * Math.pow(2, S.cdLvl);
  const cdBtn = document.getElementById('buyCd');
  cdBtn.textContent = cdCost.toLocaleString('ru-RU')+' ₽';
  cdBtn.disabled = S.rub < cdCost || S.cdLvl >= 8;
  document.getElementById('luckVal').textContent = S.luckLvl*4;
  document.getElementById('luckLvl').textContent = S.luckLvl;
  const luckCost = Math.floor(500 * Math.pow(2.3, S.luckLvl));
  const luckBtn = document.getElementById('buyLuck');
  luckBtn.textContent = luckCost.toLocaleString('ru-RU')+' ₽';
  luckBtn.disabled = S.rub < luckCost || S.luckLvl >= 8;
  document.getElementById('autoVal').textContent = S.autoLvl*2;
  document.getElementById('autoLvl').textContent = S.autoLvl;
  const autoCost = 1000 * Math.pow(2, S.autoLvl);
  const autoBtn = document.getElementById('buyAuto');
  autoBtn.textContent = autoCost.toLocaleString('ru-RU')+' ₽';
  autoBtn.disabled = S.rub < autoCost || S.autoLvl >= 8;
  updateDropCostsUI(); updateCd(); updateEarnStats(); updateDailyUI(); updateAcctUI();
}
