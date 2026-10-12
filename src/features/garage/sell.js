import { extractRegion } from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import { addAcctLog } from '../accountant/session.js';
import { renderExchange } from '../exchange/view.js';
import { getFiltered, renderCollection } from './view.js';
import { updateBalances } from '../hud/balance.js';
import {
  updateAchievements,
  updateStats,
} from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { SALE_ROLL_MS } from '../../config/constants.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

function pushListing(num, price, kind){
  const now = Date.now();
  market.listings.push({
    numId: Number(num.id),
    price,
    sessions: 0,
    kind,
    listedAt: now,
    nextRollAt: now + SALE_ROLL_MS
  });
}

// SELL
function confirmFavorite(num, verb){
  if(!num.favorite) return true;
  return confirm(verb + ' избранный номер ' + num.plate + '?');
}

export function sellLow(numId){
  const num = S.col.find(n => n.id === numId);
  if(!num || num.listed) return;
  if(!confirmFavorite(num, 'Мгновенно продать')) return;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag), num.plate);
  const coef = Math.max(10, Math.min(90, S.coefLow)) / 100;
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
  if(!confirmFavorite(num, 'Выставить')) return;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag), num.plate);
  const price = Math.max(1, Math.round(hypo));
  num.listed = true;
      pushListing(num, price, 'mid');
  notify('📋 ' + num.plate + ' выставлен по рынку за ' + price.toLocaleString('ru-RU') + ' ₽');
  Sound.click();
  updateBalances(); renderCollection(); renderExchange(); save();
}

export function sellHigh(numId){
  const num = S.col.find(n => n.id === numId);
  if(!num || num.listed) return;
  if(!confirmFavorite(num, 'Выставить выше рынка')) return;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag), num.plate);
  const coef = Math.max(1, Math.min(200, S.coefHigh)) / 100;
  const price = Math.max(1, Math.round(hypo * (1 + coef)));
  num.listed = true;
  pushListing(num, price, 'high');
  notify('📈 ' + num.plate + ' выставлен за ' + price.toLocaleString('ru-RU') + ' ₽');
  Sound.click();
  updateBalances(); renderCollection(); renderExchange(); save();
}

function unitPrice(num, kind){
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag), num.plate);
  if(kind === 'low'){
    const coef = Math.max(10, Math.min(90, S.coefLow)) / 100;
    return Math.max(1, Math.round(hypo * (1 - coef)));
  }
  if(kind === 'high'){
    const coef = Math.max(1, Math.min(200, S.coefHigh)) / 100;
    return Math.max(1, Math.round(hypo * (1 + coef)));
  }
  return Math.max(1, Math.round(hypo));
}

export function bulkCandidates(){
  return getFiltered().filter(n => !n.listed && !n.favorite);
}

export function bulkQuote(){
  const items = bulkCandidates();
  let low = 0, mid = 0, high = 0;
  for(const n of items){
    low += unitPrice(n, 'low');
    mid += unitPrice(n, 'mid');
    high += unitPrice(n, 'high');
  }
  return { count: items.length, low, mid, high };
}

export function sellBulk(kind){
  const items = bulkCandidates();
  if(!items.length){
    notify('Нечего продавать: избранное и номера на бирже не беру');
    Sound.error();
    return;
  }
  const priced = items.map(n => ({ n, price: unitPrice(n, kind) }));
  const sum = priced.reduce((s, x) => s + x.price, 0);
  const verb = kind === 'low' ? 'Мгновенно продать' : kind === 'high' ? 'Выставить выше рынка' : 'Выставить по рынку';
  const money = kind === 'low' ? ' за ' : ' на ';
  if(!confirm(verb + ' ' + priced.length + ' номеров' + money + sum.toLocaleString('ru-RU') + ' ₽?\nИзбранное и лоты, которые уже на бирже, останутся.')) return;
  if(kind === 'low'){
    const ids = new Set(priced.map(x => x.n.id));
    S.rub += sum;
    S.totalEarned += sum;
    S.col = S.col.filter(n => !ids.has(n.id));
    Sound.sell(); haptic(10);
    notify('⚡ Продано ' + priced.length + ' номеров за ' + sum.toLocaleString('ru-RU') + ' ₽');
    addAcctLog('⚡ Массовая продажа · ' + priced.length + ' шт · ' + sum.toLocaleString('ru-RU') + ' ₽', 'n');
  } else {
    for(const { n, price } of priced){
      n.listed = true;
      pushListing(n, price, kind === 'high' ? 'high' : 'mid');
    }
    Sound.click();
    notify((kind === 'high' ? '📈 ' : '📋 ') + priced.length + ' номеров выставлено на ' + sum.toLocaleString('ru-RU') + ' ₽');
    addAcctLog('📋 На биржу · ' + priced.length + ' шт · ' + sum.toLocaleString('ru-RU') + ' ₽', 'n');
  }
  updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements(); save();
}
