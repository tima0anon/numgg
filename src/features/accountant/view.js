import { updateBalances } from '../hud/balance.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';

// ACCOUNTANT UI
export function acctUpgradeCost(kind){ const lvl = S.acct[kind]; const base = kind==='speed' ? 800 : kind==='accuracy' ? 1200 : 600; return Math.floor(base * Math.pow(2.1, lvl)); }

export function updateAcctUI(){
  document.querySelectorAll('#acctMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === S.acct.mode));
  document.getElementById('acctAnalyzed').textContent = S.acct.analyzed.toLocaleString('ru-RU');
  document.getElementById('acctFound').textContent = S.acct.found.toLocaleString('ru-RU');
  document.getElementById('acctDeals').textContent = S.acct.deals.toLocaleString('ru-RU');
  document.getElementById('acctProfit').textContent = Math.round(S.acct.profit).toLocaleString('ru-RU')+' ₽';
  document.getElementById('acctSpeedLvl').textContent = S.acct.speed;
  document.getElementById('acctAccuracyLvl').textContent = S.acct.accuracy;
  document.getElementById('acctRiskLvl').textContent = S.acct.risk;
  document.getElementById('acctThresholdVal').textContent = S.acct.threshold;
  const spdBtn = document.getElementById('buyAcctSpeed');
  const spdC = acctUpgradeCost('speed');
  spdBtn.innerHTML = 'Купить <span>'+spdC.toLocaleString('ru-RU')+'</span> ₽';
  spdBtn.disabled = S.rub < spdC || S.acct.speed >= 8;
  const accBtn = document.getElementById('buyAcctAccuracy');
  const accC = acctUpgradeCost('accuracy');
  accBtn.innerHTML = 'Купить <span>'+accC.toLocaleString('ru-RU')+'</span> ₽';
  accBtn.disabled = S.rub < accC || S.acct.accuracy >= 8;
  const riskBtn = document.getElementById('buyAcctRisk');
  const riskC = acctUpgradeCost('risk');
  riskBtn.innerHTML = 'Купить <span>'+riskC.toLocaleString('ru-RU')+'</span> ₽';
  riskBtn.disabled = S.rub < riskC || S.acct.risk >= 8;
  document.getElementById('acctAutoBuyVal').textContent = S.acct.autoBuy ? 'вкл' : 'выкл';
  document.getElementById('acctAutoSellVal').textContent = S.acct.autoSell ? 'вкл' : 'выкл';
}

export function buyAcctSkill(kind){
  const c = acctUpgradeCost(kind);
  if(S.rub < c || S.acct[kind] >= 8) return;
  S.rub -= c; S.acct[kind]++;
  Sound.buy(); updateBalances(); updateAcctUI(); save();
  notify('🧮 '+({speed:'скорость',accuracy:'точность',risk:'риск'})[kind]+' → '+S.acct[kind]);
}
