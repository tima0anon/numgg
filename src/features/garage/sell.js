import { extractRegion } from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import { addAcctLog } from '../accountant/session.js';
import { renderExchange } from '../exchange/view.js';
import { renderCollection } from './view.js';
import { updateBalances } from '../hud/balance.js';
import {
  updateAchievements,
  updateStats,
} from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

// SELL
export function sellLow(numId){
  const num = S.col.find(n => n.id === numId);
  if(!num || num.listed) return;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag));
  const coef = Math.max(1, Math.min(90, S.coefLow)) / 100;
  const price = Math.max(1, Math.round(hypo * (1 - coef)));
  S.rub += price; S.totalEarned += price;
  const idx = S.col.findIndex(n => n.id === numId);
  if(idx >= 0) S.col.splice(idx, 1);
  Sound.sell(); haptic(10);
  notify('⚡ Мгновенно продан ' + num.plate + ' за ' + price.toLocaleString('ru-RU') + ' ₽');
  addAcctLog('⚡ Мгновенная продажа ' + num.plate + ' · ' + price.toLocaleString('ru-RU') + ' ₽', 'n');
  updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements(); save();
}

export function sellMid(numId){
  const num = S.col.find(n => n.id === numId);
  if(!num || num.listed) return;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag));
  const price = Math.max(1, Math.round(hypo));
  num.listed = true;
  market.listings.push({ numId: num.id, price, sessions: 0, kind:'mid' });
  notify('📋 ' + num.plate + ' выставлен по рынку за ' + price.toLocaleString('ru-RU') + ' ₽');
  Sound.click();
  updateBalances(); renderCollection(); renderExchange(); save();
}

export function sellHigh(numId){
  const num = S.col.find(n => n.id === numId);
  if(!num || num.listed) return;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag));
  const coef = Math.max(1, Math.min(200, S.coefHigh)) / 100;
  const price = Math.max(1, Math.round(hypo * (1 + coef)));
  num.listed = true;
  market.listings.push({ numId: num.id, price, sessions: 0, kind:'high' });
  notify('📈 ' + num.plate + ' выставлен за ' + price.toLocaleString('ru-RU') + ' ₽');
  Sound.click();
  updateBalances(); renderCollection(); renderExchange(); save();
}
