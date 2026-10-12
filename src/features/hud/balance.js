import { autoCost, autoPerSec, luckBump, luckCost, UPGRADE_MAX } from '../config/constants.js';
import { updateAcctUI } from '../accountant/view.js';
import { rememberPeak } from '../rank/board.js';
import { updateStats } from './stats.js';
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
  rememberPeak();
  animateRubTo(S.rub);
  document.getElementById('cdVal').textContent = (cooldownMs()/1000).toFixed(1);
  document.getElementById('cdLvl').textContent = S.cdLvl;
  const cdCost = 88000 * Math.pow(2, S.cdLvl);
  const cdBtn = document.getElementById('buyCd');
  cdBtn.textContent = cdCost.toLocaleString('ru-RU')+' ₽';
  cdBtn.disabled = S.rub < cdCost || S.cdLvl >= 8;
  document.getElementById('luckVal').textContent = Math.round(luckBump(S.luckLvl) * 100);
  document.getElementById('luckLvl').textContent = S.luckLvl;
  const luckPrice = luckCost(S.luckLvl);
  const luckBtn = document.getElementById('buyLuck');
  luckBtn.textContent = luckPrice.toLocaleString('ru-RU')+' ₽';
  luckBtn.disabled = S.rub < luckPrice || S.luckLvl >= UPGRADE_MAX;
  document.getElementById('autoVal').textContent = autoPerSec(S.autoLvl).toLocaleString('ru-RU');
  document.getElementById('autoLvl').textContent = S.autoLvl;
  const autoPrice = autoCost(S.autoLvl);
  const autoBtn = document.getElementById('buyAuto');
  autoBtn.textContent = autoPrice.toLocaleString('ru-RU')+' ₽';
  autoBtn.disabled = S.rub < autoPrice || S.autoLvl >= UPGRADE_MAX;
  updateDropCostsUI(); updateCd(); updateEarnStats(); updateDailyUI(); updateAcctUI(); updateStats();
}
