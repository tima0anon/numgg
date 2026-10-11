import { updateBalances } from '../hud/balance.js';
import { Sound } from '../../services/audio.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

// UPGRADES
export function buyCd(){ const c = 200*Math.pow(2, S.cdLvl); if(S.rub < c || S.cdLvl >= 8) return; S.rub -= c; S.cdLvl++; Sound.buy(); updateBalances(); save(); }

export function buyLuck(){ const c = Math.floor(500*Math.pow(2.3, S.luckLvl)); if(S.rub < c || S.luckLvl >= 8) return; S.rub -= c; S.luckLvl++; Sound.buy(); updateBalances(); save(); }

export function buyAuto(){ const c = 1000*Math.pow(2, S.autoLvl); if(S.rub < c || S.autoLvl >= 8) return; S.rub -= c; S.autoLvl++; Sound.buy(); updateBalances(); save(); startAuto(); }

export function startAuto(){ if(flags.autoTimer) clearInterval(flags.autoTimer); if(S.autoLvl === 0) return; flags.autoTimer = setInterval(() => { S.rub += S.autoLvl*2; updateBalances(); save(); }, 1000); }
