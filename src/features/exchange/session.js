import { OFFER_TTL_MS, SALE_ROLL_MS, SESSION_MS } from '../../config/constants.js';
import {
  isRecentPlate,
  rememberPlate,
} from '../../domain/memory.js';
import {
  COUNTRIES,
  extractRegion,
} from '../../domain/plates/countries.js';
import { marketMood, saleChance } from '../../domain/demand.js';
import { hypoPrice } from '../../domain/pricing.js';
import { rnd } from '../../domain/random.js';
import {
  addAcctLog,
  runAccountantSession,
} from '../accountant/session.js';
import {
  renderExchange,
  updateNavBadge,
} from './view.js';
import { renderCollection } from '../garage/view.js';
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

export function weightedRarityForOffers(){
  const r = Math.random();
  if(r < 0.16) return 'common';
  if(r < 0.36) return 'uncommon';
  if(r < 0.58) return 'rare';
  if(r < 0.76) return 'epic';
  if(r < 0.88) return 'legendary';
  if(r < 0.96) return 'mythic';
  return 'divine';
}

function desiredBargain(){
  const roll = Math.random();
  let edge;
  if(roll < 0.52) edge = 20 + Math.random() * 180;
  else if(roll < 0.72) edge = 800 + Math.random() * 700;
  else if(roll < 0.86) edge = 2800 + Math.random() * 2400;
  else if(roll < 0.95) edge = 11000 + Math.random() * 8000;
  else edge = 80000 + Math.random() * 70000;
  if(Math.random() < 0.5) edge = -edge;
  return { edge };
}

function rarityForBargain(edge){
  const size = Math.abs(edge);
  if(size >= 60000) return Math.random() < 0.4 ? 'divine' : 'mythic';
  if(size >= 10000) return Math.random() < 0.45 ? 'mythic' : 'legendary';
  if(size >= 2500) return Math.random() < 0.5 ? 'legendary' : 'epic';
  if(size >= 700) return Math.random() < 0.45 ? 'epic' : 'rare';
  return weightedRarityForOffers();
}

function botSnatch(edge){
  if(edge < 80) return 0;
  if(edge >= 700) return 0.04;
  return 0.012;
}

export function makeOffer(){
  const bargain = desiredBargain();
  const rid = rarityForBargain(bargain.edge);
  const cd = rnd(COUNTRIES);
  let res, attempts=0;
  do { res = cd.gen(rid); attempts++; } while(isRecentPlate(res.plate, cd.flag) && attempts < 20);
  rememberPlate(res.plate, cd.flag);
  const region = extractRegion(res.plate, cd.flag);
  const hypo = hypoPrice(rid, cd.flag, region);
  let edge = bargain.edge;
  const cap = hypo * 0.82;
  if(Math.abs(edge) > cap) edge = Math.sign(edge || 1) * Math.round(hypo * (0.35 + Math.random() * 0.4));
  const listedAt = Date.now();
  const life = Math.abs(edge) >= 700 ? 3000 + Math.random() * 1000 : OFFER_TTL_MS;
  return {
    id: 'o' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    plate: res.plate, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, price: Math.max(1, Math.round(hypo - edge)),
    listedAt, until: listedAt + life, accountantFound: false
  };
}

export function makeOrder(){
  let rid;
  const r = Math.random();
  if(r < 0.2) rid = 'common';
  else if(r < 0.42) rid = 'uncommon';
  else if(r < 0.64) rid = 'rare';
  else if(r < 0.82) rid = 'epic';
  else if(r < 0.93) rid = 'legendary';
  else if(r < 0.98) rid = 'mythic';
  else rid = 'divine';
  const cd = rnd(COUNTRIES);
  const res = cd.gen(rid);
  const region = extractRegion(res.plate, cd.flag);
  let wildcardRatio;
  wildcardRatio = 0.08;
  const mask = maskPlate(res.plate, wildcardRatio);
  const spec = specificity(mask);
  const hypo = hypoPrice(rid, cd.flag, region);
  const markup = 0.5 + Math.random() * 1.5;
  const reward = Math.max(1, Math.round(hypo * (1 + markup)));
  const now = Date.now();
  let lifetime = SESSION_MS;
  if(spec >= 0.85) lifetime = 120000 + ~~(Math.random()*60000);
  else if(spec >= 0.7) lifetime = 60000 + ~~(Math.random()*60000);
  else if(spec >= 0.5) lifetime = 30000 + ~~(Math.random()*30000);
  return {
    id: 'r' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    mask, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, reward, specificity: spec,
    createdAt: now, until: now + lifetime, accountantFound: false
  };
}

export function maskPlate(plate, ratio){
  const chars = plate.split('');
  const hidden = [];
  for(let i=0;i<chars.length;i++){
    if(chars[i] === ' ') continue;
    if(Math.random() < ratio){ chars[i] = '*'; hidden.push(i); }
  }
  while(hidden.length > 1){
    const at = hidden.splice(~~(Math.random()*hidden.length), 1)[0];
    chars[at] = plate[at];
  }
  if(!hidden.length){
    const open = [];
    for(let i=0;i<plate.length;i++) if(plate[i] !== ' ') open.push(i);
    if(open.length) chars[open[~~(Math.random()*open.length)]] = '*';
  }
  return chars.join('');
}

export function specificity(mask){
  let lit=0, tot=0;
  for(const ch of mask){
    if(ch === ' ') continue;
    tot++;
    if(ch !== '*') lit++;
  }
  return tot > 0 ? lit/tot : 0;
}

export function orderMultiplier(spec){ return 1.2 + 3.8 * Math.pow(spec, 1.6); }

export function plateMatchesMask(plate, mask){
  if(plate.length !== mask.length) return false;
  for(let i=0;i<plate.length;i++) if(mask[i] !== '*' && mask[i] !== plate[i]) return false;
  return true;
}

export function findMatchingNumbers(mask){ return S.col.filter(n => plateMatchesMask(n.plate, mask) && !n.listed); }

export function generateExchangeSession(){
  market.sessionNum++;
  market.sessionNextAt = Date.now() + SESSION_MS;
  const now = Date.now();
  market.offers = [];
  market.orders = [];

  const targetOrders = 12;
  refillOffers(now);

  market.orders = market.orders.filter(o => o.until > now + 5000).slice(0, 10);
  let longOrders = market.orders.filter(o => (o.until - o.createdAt) > 60000).length;
  while(market.orders.length < targetOrders){
    const o = makeOrder();
    const isLong = (o.until - o.createdAt) > 60000;
    if(isLong && longOrders >= 10) o.until = Date.now() + SESSION_MS;
    else if(isLong) longOrders++;
    market.orders.push(o);
  }
  if(market.orders.length > targetOrders) market.orders = market.orders.slice(0, targetOrders);

  bumpListingsSessions();
  runAccountantSession();
  renderExchange();
  updateNavBadge();
  save();
}

export function bumpListingsSessions(){ for(const l of market.listings) l.sessions++; }

export function refillOffers(now){
  const targetOffers = 96;
  market.offers = market.offers.filter(o => o && !o._removed && (o.until || o.listedAt + OFFER_TTL_MS) > now);
  while(market.offers.length < targetOffers) market.offers.push(makeOffer());
  if(market.offers.length > targetOffers) market.offers = market.offers.slice(-targetOffers);
}

export function tickExchange(){
  const now = Date.now();
  let removed = 0;
  for(let i=market.offers.length-1;i>=0;i--){
    const o = market.offers[i];
    const until = o.until || (o.listedAt + OFFER_TTL_MS);
    if(now >= until){ market.offers.splice(i, 1); removed++; continue; }
    const edge = o.hypo - o.price;
    if(Math.random() < botSnatch(edge)){ market.offers.splice(i, 1); removed++; }
  }
  refillOffers(now);
  for(let i=market.orders.length-1;i>=0;i--){
    const o = market.orders[i];
    if(now > o.until){ market.orders.splice(i,1); removed++; continue; }
    const spec = o.specificity;
    let p = 0.0005 * (1 - spec) + 0.0002;
    if(spec >= 0.85) p *= 0.3;
    if(Math.random() < p){ market.orders.splice(i, 1); removed++; }
  }
  updateSessionCountdown();
  document.querySelectorAll('#exOfferGrid .lot-life').forEach(el => {
    const left = Math.max(0, Math.ceil((Number(el.dataset.until) - now) / 1000));
    el.textContent = left + ' с';
  });
  if(removed && now - (market.offerPaintAt || 0) > 700 && document.getElementById('page-exchange')?.classList.contains('active')){
    market.offerPaintAt = now;
    const active = document.activeElement;
    const typing = active && active.closest && active.closest('#page-exchange') && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA');
    if(!typing){
      const top = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
      renderExchange();
      if(document.scrollingElement) document.scrollingElement.scrollTop = top;
    }
  }
  document.querySelectorAll('.roll-wait').forEach(el => {
    const left = Math.max(0, Math.ceil((Number(el.dataset.until) - now) / 1000));
    el.textContent = String(left);
  });
  rollListings(now);
  if(now >= market.sessionNextAt){
    generateExchangeSession();
  }
}

export function rollListings(now = Date.now()){
  if(!market.listings.length) return false;
  const sold = [];
  let spun = false;
  for(let i=market.listings.length-1;i>=0;i--){
    const l = market.listings[i];
    if(!l.nextRollAt) l.nextRollAt = now + SALE_ROLL_MS;
    if(now < l.nextRollAt) continue;
    const num = S.col.find(n => Number(n.id) === Number(l.numId));
    if(!num){ market.listings.splice(i,1); continue; }
    spun = true;
    l.nextRollAt = now + SALE_ROLL_MS;
    const region = extractRegion(num.plate, num.flag);
    const hypo = hypoPrice(num.rarity, num.flag, region);
    const mood = marketMood(num.flag, region, num.rarity);
    const chance = saleChance(l.price, hypo, mood);
    if(Math.random() < chance){
      S.rub += l.price; S.totalEarned += l.price;
      const idx = S.col.findIndex(n => Number(n.id) === Number(l.numId));
      if(idx >= 0) S.col.splice(idx, 1);
      market.listings.splice(i,1);
      sold.push({ plate: num.plate, price: l.price });
    } else {
      l.missUntil = now + 2200;
    }
  }
  if(!spun) return false;
  if(sold.length === 1){
    notify('💸 ' + sold[0].plate + ' продан за ' + sold[0].price.toLocaleString('ru-RU') + ' ₽');
    addAcctLog('💸 Продан ' + sold[0].plate + ' за ' + sold[0].price.toLocaleString('ru-RU') + ' ₽', 'ok');
    Sound.sell(); haptic(10);
  } else if(sold.length > 1){
    const sum = sold.reduce((s, x) => s + x.price, 0);
    notify('💸 Продано ' + sold.length + ' лотов на ' + sum.toLocaleString('ru-RU') + ' ₽');
    addAcctLog('💸 Продано лотов: ' + sold.length + ' · ' + sum.toLocaleString('ru-RU') + ' ₽', 'ok');
    Sound.sell(); haptic(10);
  }
  updateBalances();
  const active = document.activeElement;
  const typing = active && active.closest && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA');
  if(!typing){ renderCollection(); renderExchange(); }
  save();
  return true;
}

export function updateSessionCountdown(){
  const el = document.getElementById('sessionCountdown');
  if(!el) return;
  el.textContent = (Math.max(0, market.sessionNextAt - Date.now())/1000).toFixed(1)+'с';
}

export function doBuyOffer(o, silent, batch){
  if(!o || !market.offers.some(x => x.id === o.id)) return false;
  const now = Date.now();
  if(!silent && !batch && now < (market.nextBuyAt || 0)){
    notify('Следующая покупка через '+Math.ceil((market.nextBuyAt - now)/1000)+' с');
    Sound.error();
    return false;
  }
  if(S.rub < o.price){ if(!silent && !batch) notify('Недостаточно денег'); return false; }
  S.rub -= o.price; S.totalSpent += o.price;
  const item = { id: S.nextId++, country: o.country, flag: o.flag, plate: o.plate, rarity: o.rarity, price: o.hypo, bought: o.price, favorite: false, region: o.region };
  S.col.push(item);
  if(!S.bestNum || item.price > S.bestNum.price) S.bestNum = item;
  const idx = market.offers.findIndex(x => x.id === o.id);
  if(idx >= 0) market.offers.splice(idx,1);
  if(!batch){ Sound.buy(); haptic(15); }
  if(!silent && !batch){
    market.nextBuyAt = Date.now() + 2000;
    setTimeout(() => { if(Date.now() >= (market.nextBuyAt || 0)) renderExchange(); }, 2000);
  }
  if(silent && !batch) addAcctLog('Купил ' + o.plate + ' за ' + o.price.toLocaleString('ru-RU') + ' ₽, рынок ' + Math.round(o.hypo).toLocaleString('ru-RU') + ' ₽', 'ok');
  else if(!batch) notify('Куплено: ' + o.plate + ' за ' + o.price.toLocaleString('ru-RU') + ' ₽');
  S.acct.deals++;
  S.acct.profit += (o.hypo - o.price);
  if(!batch){
    updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements();
    save();
  }
  return true;
}

export function doFulfillOrder(orderId, numId, silent, batch){
  const o = market.orders.find(x => x.id === orderId);
  const num = S.col.find(n => n.id === numId);
  if(!o || !num) return false;
  if(num.listed){ if(!silent && !batch) notify('Сначала сними номер с продажи'); return false; }
  if(silent && num.favorite) return false;
  if(!plateMatchesMask(num.plate, o.mask)){ if(!silent && !batch) notify('Не подходит под маску'); return false; }
  const reward = o.reward;
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag));
  S.rub += reward; S.totalEarned += reward;
  const idx = S.col.findIndex(n => n.id === numId);
  if(idx >= 0) S.col.splice(idx, 1);
  const oIdx = market.orders.findIndex(x => x.id === orderId);
  if(oIdx >= 0) market.orders.splice(oIdx,1);
  const listIdx = market.listings.findIndex(l => l.numId === numId);
  if(listIdx >= 0) market.listings.splice(listIdx, 1);
  if(!batch){ Sound.coin_big(); haptic([20,20,40]); }
  S.acct.deals++;
  S.acct.profit += (reward - hypo);
  if(silent && !batch) addAcctLog('Продал ' + num.plate + ' в заказ за ' + reward.toLocaleString('ru-RU') + ' ₽, рынок номера ' + Math.round(hypo).toLocaleString('ru-RU') + ' ₽', 'ok');
  else if(!batch) notify('🎯 Заказ выполнен: +' + reward.toLocaleString('ru-RU') + ' ₽');
  if(!batch){
    updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements();
    save();
  }
  return true;
}
