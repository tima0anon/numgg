import {
  MAX_CUSTOM_SPIN,
  PROMO_CODES,
  PROMO_REWARDS,
  TEST_ADMIN_OFF,
  TEST_ADMIN_ON,
} from '../../config/constants.js';
import { doDrop, updateDropCostsUI } from '../drop/spin.js';
import { updateBalances } from '../hud/balance.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';
import { switchPage } from './chrome.js';

function field(){
  return document.getElementById('customSpinCount');
}

function codeOf(raw){
  return String(raw || '').trim().toLocaleUpperCase('ru-RU');
}

export function isSpinCode(raw){
  return knownCode(codeOf(raw));
}

function knownCode(code){
  return PROMO_CODES.includes(code) || code === TEST_ADMIN_ON || code === TEST_ADMIN_OFF;
}

function syncAdminNav(){
  const nav = document.getElementById('adminNav');
  if(nav) nav.hidden = !S.testAdmin;
}

export function enableTestAdmin(){
  S.testAdmin = true;
  save();
  syncAdminNav();
  switchPage('admin');
  Sound.coin_big();
  notify('Открыто');
}

export function disableTestAdmin(){
  S.testAdmin = false;
  save();
  syncAdminNav();
  if(document.getElementById('page-admin')?.classList.contains('active')) switchPage('drop');
  Sound.click();
  notify('Закрыто');
}

function redeemPromo(code){
  if(!Array.isArray(S.usedPromos)) S.usedPromos = [];
  if(S.usedPromos.includes(code)){
    notify('Этот промокод уже использован');
    Sound.error();
    return;
  }
  const reward = PROMO_REWARDS[code] || 0;
  S.usedPromos.push(code);
  S.rub += reward;
  S.totalEarned += reward;
  Sound.coin_big();
  haptic([30, 20, 40]);
  updateBalances();
  save();
  notify('💵 +' + reward.toLocaleString('ru-RU') + ' ₽');
}

function applyCode(code){
  if(PROMO_CODES.includes(code)){ redeemPromo(code); return true; }
  if(code === TEST_ADMIN_ON){ enableTestAdmin(); return true; }
  if(code === TEST_ADMIN_OFF){ disableTestAdmin(); return true; }
  return false;
}

export function restoreSpinField(){
  const inp = field();
  if(inp) inp.value = String(S.customSpinN || 25);
  updateDropCostsUI();
}

export function triggerCustomSpin(){
  const inp = field();
  if(!inp) return;
  const raw = inp.value.trim();
  const code = codeOf(raw);
  if(knownCode(code)){
    applyCode(code);
    restoreSpinField();
    return;
  }
  let n = parseInt(raw, 10);
  if(!isFinite(n) || n < 1) n = 1;
  if(n > MAX_CUSTOM_SPIN) n = MAX_CUSTOM_SPIN;
  inp.value = String(n);
  S.customSpinN = n;
  save();
  updateDropCostsUI();
  doDrop(n);
}

export function previewSpinField(){
  const inp = field();
  if(!inp) return;
  const raw = inp.value.trim();
  if(knownCode(codeOf(raw)) || !/^\d+$/.test(raw)) return;
  updateDropCostsUI();
}

export { syncAdminNav };
