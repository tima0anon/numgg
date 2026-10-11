import {
  bulkCost,
  cooldownMs,
  doDrop,
} from './spin.js';
import { Sound } from '../../services/audio.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

// AUTOSPIN
export function startAutoSpinTimer(){
  if(flags.autoSpinTimer) clearInterval(flags.autoSpinTimer);
  if(!S.autoSpin) return;
  flags.autoSpinTimer = setInterval(() => {
    if(!S.autoSpin || flags.spinning) return;
    if(Date.now() - S.lastSpin < cooldownMs()) return;
    if(S.rub < bulkCost(1)){ stopAutoSpin(); return; }
    doDrop(1);
  }, 200);
}

export function stopAutoSpin(){
  S.autoSpin = false;
  if(flags.autoSpinTimer){ clearInterval(flags.autoSpinTimer); flags.autoSpinTimer = null; }
  updateAutoSpinUI(); save();
}

export function toggleAutoSpin(){
  S.autoSpin = !S.autoSpin;
  Sound.click();
  if(S.autoSpin) startAutoSpinTimer();
  else if(flags.autoSpinTimer){ clearInterval(flags.autoSpinTimer); flags.autoSpinTimer = null; }
  updateAutoSpinUI(); save();
}

export function updateAutoSpinUI(){
  const btn = document.getElementById('autoSpinToggle'), lbl = document.getElementById('autoSpinLabel');
  if(!btn || !lbl) return;
  btn.classList.toggle('on', S.autoSpin);
  lbl.textContent = S.autoSpin ? 'Автопрокрут: ВКЛ' : 'Автопрокрут: ВЫКЛ';
}

export function updateAutoSellUI(){ const s = document.getElementById('autoSellSelect'); if(s) s.value = S.autoSell; }
