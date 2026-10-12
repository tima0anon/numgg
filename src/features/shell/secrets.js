import {
  MAX_CUSTOM_SPIN,
  SECRET_CASH,
  SECRET_CASH_CODE,
  SECRET_CODE,
  SECRET_FULL_CODE,
  SECRET_REWARD,
} from '../../config/constants.js';
import {
  isRecentPlate,
  rememberPlate,
} from '../../domain/memory.js';
import {
  COUNTRIES,
  extractRegion,
} from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import { doDrop } from '../drop/spin.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';
import {
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import {
  flashScreen,
  spawnConfetti,
} from '../../services/fx.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { readSession, redeemCashCode } from '../../services/remote.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';

// SECRET
export function triggerEasterEgg(){
  S.rub += SECRET_REWARD; S.totalEarned += SECRET_REWARD;
  Sound.divine(); spawnConfetti(500, ['#ffcc00','#ff9500','#ffd60a','#ff2d55','#0a84ff']); flashScreen();
  haptic([80,50,80,50,200,50,300]);
  updateBalances(); save();
  notify('🌟 +1 500 000 000 ₽');
}

export function triggerFullCollection(){
  const cids = ['ru','by','cn','us','ua'];
  const rids = ['common','uncommon','rare','epic','legendary','mythic','divine'];
  let added = 0, totalVal = 0;
  cids.forEach(cid => {
    const c = COUNTRIES.find(x => x.id === cid); if(!c) return;
    rids.forEach(rid => {
      let res, a=0;
      do { res = c.gen(rid); a++; } while(isRecentPlate(res.plate, c.flag) && a < 40);
      rememberPlate(res.plate, c.flag);
      const region = extractRegion(res.plate, c.flag);
      const price = hypoPrice(rid, c.flag, region, res.plate);
      const item = { id: S.nextId++, country: c.name, flag: c.flag, plate: res.plate, rarity: rid, price, region, favorite: true };
      S.col.push(item);
      S.rarityCount[rid] = (S.rarityCount[rid]||0)+1;
      if(!S.bestNum || item.price > S.bestNum.price) S.bestNum = item;
      added++; totalVal += price;
    });
  });
  Sound.divine(); spawnConfetti(500); flashScreen();
  updateBalances(); renderCollection(); updateStats(); updateAchievements(); updateRarityStats(); save();
  notify('🎁 Полная коллекция! +'+added+' номеров');
}

export async function triggerCashCode(){
  if(S.usedCashCode){ notify('Этот код уже использован'); Sound.error(); return; }
  S.usedCashCode = true;
  save();
  if(readSession()){
    try { await redeemCashCode(); }
    catch(error){
      if(error.status === 409){ notify('Код уже использован на этом аккаунте'); Sound.error(); return; }
    }
  }
  S.rub += SECRET_CASH; S.totalEarned += SECRET_CASH;
  Sound.coin_big(); haptic([30,20,40]);
  updateBalances(); save();
  notify('💵 +'+SECRET_CASH.toLocaleString('ru-RU')+' ₽');
}

export function triggerCustomSpin(){
  const inp = document.getElementById('customSpinCount'); if(!inp) return;
  let n = parseInt(inp.value, 10);
  if(n === SECRET_CODE){ triggerEasterEgg(); return; }
  if(n === SECRET_FULL_CODE){ triggerFullCollection(); return; }
  if(n === SECRET_CASH_CODE){ triggerCashCode(); return; }
  if(!isFinite(n) || n < 1) n = 1;
  if(n > MAX_CUSTOM_SPIN) n = MAX_CUSTOM_SPIN;
  inp.value = n; S.customSpinN = n; save();
  doDrop(n);
}
