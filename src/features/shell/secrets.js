import {
  MAX_CUSTOM_SPIN,
  PROMO_CODES,
  PROMO_REWARDS,
} from '../../config/constants.js';
import { doDrop, updateDropCostsUI } from '../drop/spin.js';
import { updateBalances } from '../hud/balance.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { readSession } from '../../services/remote.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';

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
  return PROMO_CODES.includes(code);
}

export function syncAdminNav(){
  const session = readSession();
  S.testAdmin = !!(session && session.role === 'admin');
  const nav = document.getElementById('adminNav');
  if(nav) nav.hidden = !S.testAdmin;
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
