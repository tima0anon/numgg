import { SESSION_MS, TICK_MS } from '../../config/constants.js';
import { RARITY_ORDER } from '../../config/rarity.js';
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
import { feeNote, saleCut } from '../../domain/saleFee.js';
import { randGauss, rnd } from '../../domain/random.js';
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
  if(r < 0.42) return 'common';
  if(r < 0.72) return 'uncommon';
  if(r < 0.87) return 'rare';
  if(r < 0.95) return 'epic';
  if(r < 0.985) return 'legendary';
  if(r < 0.997) return 'mythic';
  return 'divine';
}

export function makeOffer(){
  const rid = weightedRarityForOffers();
  const cd = rnd(COUNTRIES);
  let res, attempts=0;
  do { res = cd.gen(rid); attempts++; } while(isRecentPlate(res.plate, cd.flag) && attempts < 20);
  rememberPlate(res.plate, cd.flag);
  const region = extractRegion(res.plate, cd.flag);
  const hypo = hypoPrice(rid, cd.flag, region, res.plate);
  let dev = 0.06 + randGauss() * 0.08;
  const rare = Math.random();
  if(rare < 0.18) dev = (Math.random() - 0.5) * 0.02;
  else if(rare < 0.22) dev = -(0.25 + Math.random() * 0.45);
  else if(rare < 0.25) dev = 0.45 + Math.random() * 0.45;
  if(dev > 0.9) dev = 0.9;
  if(dev < -0.7) dev = -0.7;
  return {
    id: 'o' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    plate: res.plate, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, price: Math.max(1, Math.round(hypo * (1 + dev))),
    listedAt: Date.now(), accountantFound: false
  };
}

export function makeReachableOrder(cd){
  const rid = 'common';
  const res = cd.gen(rid);
  const region = extractRegion(res.plate, cd.flag);
  const mask = String(res.plate).replace(/[^\s-]/g, '*');
  const hypo = hypoPrice(rid, cd.flag, region, res.plate);
  const now = Date.now();
  return {
    id: 'r' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    mask, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, reward: Math.max(1, Math.round(hypo * 1.1)),
    specificity: 0, multiplier: 1.1, payFromPlate: true,
    createdAt: now, until: now + SESSION_MS * 3, accountantFound: false
  };
}

function ensureReachableOrders(){
  const open = COUNTRIES.filter(c => (c.id === 'by' || c.id === 'ua') && !market.orders.some(o => o.payFromPlate && o.flag === c.flag));
  for(const cd of open){
    if(market.orders.filter(o => o.payFromPlate).length >= 2) break;
    market.orders.push(makeReachableOrder(cd));
  }
  while(market.orders.length > 12){
    const idx = market.orders.findIndex(o => !o.payFromPlate);
    if(idx < 0) break;
    market.orders.splice(idx, 1);
  }
}

export function makeOrder(){
  let rid;
  const r = Math.random();
  if(r < 0.35) rid = 'common';
  else if(r < 0.60) rid = 'uncommon';
  else if(r < 0.80) rid = 'rare';
  else if(r < 0.92) rid = 'epic';
  else if(r < 0.975) rid = 'legendary';
  else if(r < 0.995) rid = 'mythic';
  else rid = 'divine';
  const cd = rnd(COUNTRIES);
  const res = cd.gen(rid);
  const region = extractRegion(res.plate, cd.flag);
  let wildcardRatio;
  if(rid === 'divine' || rid === 'mythic') wildcardRatio = 0.15;
  else if(rid === 'legendary') wildcardRatio = 0.20;
  else if(rid === 'epic') wildcardRatio = 0.30;
  else if(rid === 'rare') wildcardRatio = 0.40;
  else if(rid === 'uncommon') wildcardRatio = 0.55;
  else wildcardRatio = 0.65;
  const mask = maskPlate(res.plate, wildcardRatio);
  const spec = specificity(mask);
  const mult = orderMultiplier(spec);
  const hypo = hypoPrice(rid, cd.flag, region, res.plate);
  const reward = Math.max(1, Math.round(hypo * mult * (0.96 + Math.random()*0.08)));
  const now = Date.now();
  let lifetime = SESSION_MS;
  if(spec >= 0.85) lifetime = 120000 + ~~(Math.random()*60000);
  else if(spec >= 0.7) lifetime = 60000 + ~~(Math.random()*60000);
  else if(spec >= 0.5) lifetime = 30000 + ~~(Math.random()*30000);
  return {
    id: 'r' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    mask, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, reward, specificity: spec, multiplier: mult,
    createdAt: now, until: now + lifetime, accountantFound: false
  };
}

export function maskPlate(plate, ratio){
  let m = '';
  let stars = 0;
  for(let i=0;i<plate.length;i++){
    const ch = plate[i];
    if(ch === ' ') m += ' ';
    else if(Math.random() < ratio){ m += '*'; stars++; }
    else m += ch;
  }
  if(!stars){
    const chars = m.split('');
    const open = [];
    for(let i=0;i<plate.length;i++) if(plate[i] !== ' ') open.push(i);
    if(open.length) chars[open[~~(Math.random()*open.length)]] = '*';
    return chars.join('');
  }
  return m;
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

export function orderMultiplier(spec){ return 1.1 + 0.7 * Math.pow(spec, 1.6); }

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
  market.offers = market.offers.filter(o => o && !o._removed);
  market.orders = market.orders.filter(o => o && !o._removed && o.until > now);

  const targetOffers = 96;
  const targetOrders = 12;
  const keepCount = Math.floor(market.offers.length * 0.5);
  if(market.offers.length > keepCount) market.offers = market.offers.slice(0, keepCount);
  while(market.offers.length < targetOffers) market.offers.push(makeOffer());
  if(market.offers.length > targetOffers) market.offers = market.offers.slice(0, targetOffers);

  market.orders = market.orders.filter(o => o.until > now + 5000);
  let longOrders = market.orders.filter(o => (o.until - o.createdAt) > 60000).length;
  const maxLongOrders = Math.max(3, Math.floor(targetOrders / 4));
  while(market.orders.length < targetOrders){
    const o = makeOrder();
    const isLong = (o.until - o.createdAt) > 60000;
    if(isLong && longOrders >= maxLongOrders) o.until = Date.now() + SESSION_MS + ~~(Math.random()*SESSION_MS);
    else if(isLong) longOrders++;
    market.orders.push(o);
  }
  if(market.orders.length > targetOrders) market.orders = market.orders.slice(0, targetOrders);
  ensureReachableOrders();

  bumpListingsSessions();
  runAccountantSession();
  renderExchange();
  updateNavBadge();
  save();
}

export function bumpListingsSessions(){ for(const l of market.listings) l.sessions++; }

function ticksPerSession(){
  return Math.max(1, Math.round(SESSION_MS / TICK_MS));
}

export function tickSaleChance(sessionChance){
  if(sessionChance <= 0) return 0;
  if(sessionChance >= 1) return 1;
  return 1 - Math.pow(1 - sessionChance, 1 / ticksPerSession());
}

export function tickExchange(){
  const now = Date.now();
  let removed = 0;
  for(let i=market.offers.length-1;i>=0;i--){
    const o = market.offers[i];
    const dev = (o.hypo - o.price) / Math.max(1, o.hypo);
    const rarityBonus = RARITY_ORDER.indexOf(o.rarity) * 0.06;
    let p = 0.0003 + Math.max(0, dev) * 0.1 + rarityBonus * 0.006;
    if(dev > 0.2) p += 0.018;
    if(Math.random() < p){ market.offers.splice(i, 1); removed++; }
  }
  for(let i=market.orders.length-1;i>=0;i--){
    const o = market.orders[i];
    if(now > o.until){ market.orders.splice(i,1); removed++; continue; }
    const spec = o.specificity;
    let p = 0.0005 * (1 - spec) + 0.0002;
    if(spec >= 0.85) p *= 0.3;
    if(Math.random() < p){ market.orders.splice(i, 1); removed++; }
  }
  updateSessionCountdown();
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
  const soldListings = rollListings();
  if(soldListings && document.getElementById('page-exchange')?.classList.contains('active')){
    const active = document.activeElement;
    const typing = active && active.closest && active.closest('#page-exchange') && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA');
    if(!typing) renderExchange();
  }
  if(now >= market.sessionNextAt){
    generateExchangeSession();
  }
}

export function rollListings(){
  if(!market.listings.length) return 0;
  const sold = [];
  for(let i=market.listings.length-1;i>=0;i--){
    const l = market.listings[i];
    const num = S.col.find(n => Number(n.id) === Number(l.numId));
    if(!num){ market.listings.splice(i,1); continue; }
    const region = extractRegion(num.plate, num.flag);
    const hypo = hypoPrice(num.rarity, num.flag, region, num.plate);
    const mood = marketMood(num.flag, region, num.rarity);
    const sessionChance = saleChance(l.price, hypo, mood, num.rarity);
    if(Math.random() < tickSaleChance(sessionChance)){
      const cut = saleCut(l.price, num.bought);
      S.rub += cut.net; S.totalEarned += cut.net;
      const idx = S.col.findIndex(n => Number(n.id) === Number(l.numId));
      if(idx >= 0) S.col.splice(idx, 1);
      market.listings.splice(i,1);
      sold.push({ plate: num.plate, price: cut.net, fee: cut.fee });
    }
  }
  if(!sold.length) return 0;
  if(sold.length === 1){
    notify('💸 ' + sold[0].plate + ' продан за ' + sold[0].price.toLocaleString('ru-RU') + ' ₽' + feeNote(sold[0].fee));
    addAcctLog('💸 Продан ' + sold[0].plate + ' за ' + sold[0].price.toLocaleString('ru-RU') + ' ₽' + feeNote(sold[0].fee), 'ok');
    Sound.sell(); haptic(10);
  } else if(sold.length > 1){
    const sum = sold.reduce((s, x) => s + x.price, 0);
    const fee = sold.reduce((s, x) => s + (x.fee || 0), 0);
    notify('💸 Продано ' + sold.length + ' лотов на ' + sum.toLocaleString('ru-RU') + ' ₽' + feeNote(fee));
    addAcctLog('💸 Продано лотов: ' + sold.length + ' · ' + sum.toLocaleString('ru-RU') + ' ₽' + feeNote(fee), 'ok');
    Sound.sell(); haptic(10);
  }
  updateBalances();
  renderCollection();
  save();
  return sold.length;
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
  if(silent){
    S.acct.deals++;
    S.acct.profit += (o.hypo - o.price);
  }
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
  const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag), num.plate);
  const rewardGross = o.payFromPlate
    ? Math.max(1, Math.round(hypo * (o.multiplier || 1.1)))
    : o.reward;
  const cut = saleCut(rewardGross, num.bought);
  const reward = cut.net;
  S.rub += reward; S.totalEarned += reward;
  const idx = S.col.findIndex(n => n.id === numId);
  if(idx >= 0) S.col.splice(idx, 1);
  const oIdx = market.orders.findIndex(x => x.id === orderId);
  if(oIdx >= 0) market.orders.splice(oIdx,1);
  const listIdx = market.listings.findIndex(l => l.numId === numId);
  if(listIdx >= 0) market.listings.splice(listIdx, 1);
  if(!batch){ Sound.coin_big(); haptic([20,20,40]); }
  if(silent){
    S.acct.deals++;
    S.acct.profit += (reward - hypo);
  }
  if(silent && !batch) addAcctLog('Продал ' + num.plate + ' в заказ за ' + reward.toLocaleString('ru-RU') + ' ₽, рынок номера ' + Math.round(hypo).toLocaleString('ru-RU') + ' ₽', 'ok');
  else if(!batch) notify('🎯 Заказ выполнен: +' + reward.toLocaleString('ru-RU') + ' ₽' + feeNote(cut.fee));
  if(!batch){
    updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements();
    save();
  }
  return true;
}
