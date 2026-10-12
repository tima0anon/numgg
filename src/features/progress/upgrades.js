import { autoCost, autoPerSec, luckCost, UPGRADE_MAX } from '../../config/constants.js';
import { updateBalances } from '../hud/balance.js';
import { Sound } from '../../services/audio.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

export function buyCd(){ const c = 88000*Math.pow(2, S.cdLvl); if(S.rub < c || S.cdLvl >= UPGRADE_MAX) return; S.rub -= c; S.totalSpent += c; S.cdLvl++; Sound.buy(); updateBalances(); save(); }

export function buyLuck(){
  const c = luckCost(S.luckLvl);
  if(S.rub < c || S.luckLvl >= UPGRADE_MAX) return;
  S.rub -= c; S.totalSpent += c; S.luckLvl++;
  Sound.buy(); updateBalances(); save();
}

export function buyAuto(){
  const c = autoCost(S.autoLvl);
  if(S.rub < c || S.autoLvl >= UPGRADE_MAX) return;
  S.rub -= c; S.totalSpent += c; S.autoLvl++;
  Sound.buy(); updateBalances(); save(); startAuto();
}

export function startAuto(){
  if(flags.autoTimer) clearInterval(flags.autoTimer);
  if(S.autoLvl === 0) return;
  let ticks = 0;
  flags.autoTimer = setInterval(() => {
    const gain = autoPerSec(S.autoLvl);
    S.rub += gain;
    S.totalEarned += gain;
    updateBalances();
    ticks++;
    if(ticks >= 5){ ticks = 0; save(); }
  }, 1000);
}
