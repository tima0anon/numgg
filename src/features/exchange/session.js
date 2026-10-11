import { SESSION_MS } from '../../config/constants.js';
import { RARITY_ORDER } from '../../config/rarity.js';
import {
  isRecentPlate,
  rememberPlate,
} from '../../domain/memory.js';
import {
  COUNTRIES,
  extractRegion,
} from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import {
  randGauss,
  rnd,
} from '../../domain/random.js';
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
  const hypo = hypoPrice(rid, cd.flag, region);
  let dev = randGauss() * 0.18;
  if(dev > 0.9) dev = 0.9;
  if(dev < -0.7) dev = -0.7;
  return {
    id: 'o' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    plate: res.plate, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, price: Math.max(1, Math.round(hypo * (1 + dev))),
    listedAt: Date.now(), accountantFound: false
  };
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
  const hypo = hypoPrice(rid, cd.flag, region);
  const reward = Math.max(1, Math.round(hypo * orderMultiplier(spec) * (0.9 + Math.random()*0.25)));
  const now = Date.now();
  let lifetime = SESSION_MS;
  if(spec >= 0.85) lifetime = 180000 + ~~(Math.random()*120000);
  else if(spec >= 0.7) lifetime = 60000 + ~~(Math.random()*120000);
  else if(spec >= 0.5) lifetime = 30000 + ~~(Math.random()*60000);
  return {
    id: 'r' + (S.nextId++) + '_' + (Math.random()*1e6|0),
    mask, flag: cd.flag, country: cd.name, rarity: rid, region,
    hypo, reward, specificity: spec,
    createdAt: now, until: now + lifetime, accountantFound: false
  };
}

export function maskPlate(plate, ratio){
  let m = '';
  for(let i=0;i<plate.length;i++){
    const ch = plate[i];
    if(ch === ' ') m += ' ';
    else if(Math.random() < ratio) m += '*';
    else m += ch;
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
  market.offers = market.offers.filter(o => !o._removed);
  market.orders = market.orders.filter(o => !o._removed && o.until > now);

  const targetOffers = 40 + ~~(Math.random()*25);
  const targetOrders = 15 + ~~(Math.random()*16);

  const keepCount = Math.floor(market.offers.length * 0.5);
  if(market.offers.length > keepCount) market.offers = market.offers.slice(0, keepCount);
  const toAdd = targetOffers - market.offers.length;
  for(let i=0;i<toAdd;i++) market.offers.push(makeOffer());

  market.orders = market.orders.filter(o => o.until > now + 5000);
  const longOrders = market.orders.filter(o => (o.until - o.createdAt) > 60000).length;
  while(market.orders.length < targetOrders){
    const o = makeOrder();
    if((o.until - o.createdAt) > 60000 && longOrders >= 5) o.until = Date.now() + SESSION_MS + ~~(Math.random()*SESSION_MS*2);
    market.orders.push(o);
  }
  if(market.orders.length > targetOrders + 10) market.orders = market.orders.slice(0, targetOrders + 10);

  bumpListingsSessions();
  runAccountantSession();
  renderExchange();
  updateNavBadge();
  save();
}

export function bumpListingsSessions(){ for(const l of market.listings) l.sessions++; }

export function tickExchange(){
  const now = Date.now();
  for(let i=market.offers.length-1;i>=0;i--){
    const o = market.offers[i];
    const dev = (o.hypo - o.price) / o.hypo;
    const rarityBonus = RARITY_ORDER.indexOf(o.rarity) * 0.06;
    let p = 0.0005 + Math.max(0, dev) * 0.28 + rarityBonus * 0.01;
    if(dev > 0) p += 0.05;
    if(Math.random() < p) market.offers.splice(i, 1);
  }
  for(let i=market.orders.length-1;i>=0;i--){
    const o = market.orders[i];
    if(now > o.until){ market.orders.splice(i,1); continue; }
    const spec = o.specificity;
    let p = 0.0008 * (1 - spec) + 0.0003;
    if(spec >= 0.85) p *= 0.3;
    if(Math.random() < p) market.orders.splice(i, 1);
  }
  updateSessionCountdown();
  if(now >= market.sessionNextAt){
    rollListings();
    generateExchangeSession();
  }
}

export function rollListings(){
  if(!market.listings.length) return;
  for(let i=market.listings.length-1;i>=0;i--){
    const l = market.listings[i];
    const num = S.col.find(n => n.id === l.numId);
    if(!num){ market.listings.splice(i,1); continue; }
    const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag));
    const dev = (l.price - hypo) / hypo;
    const rarityBonus = RARITY_ORDER.indexOf(num.rarity) * 0.09;
    let chance;
    if(dev <= -0.03) chance = 1;
    else { chance = 0.55 - dev * 1.2 + rarityBonus; chance = Math.max(0.03, Math.min(0.97, chance)); }
    if(Math.random() < chance){
      S.rub += l.price; S.totalEarned += l.price;
      const idx = S.col.findIndex(n => n.id === l.numId);
      if(idx >= 0) S.col.splice(idx, 1);
      market.listings.splice(i,1);
      addAcctLog('💸 Продан ' + num.plate + ' за ' + l.price.toLocaleString('ru-RU') + ' ₽', 'ok');
      notify('💸 ' + num.plate + ' продан за ' + l.price.toLocaleString('ru-RU') + ' ₽');
      Sound.sell(); haptic(10);
    }
  }
  updateBalances(); renderCollection(); renderExchange(); save();
}

export function updateSessionCountdown(){
  const el = document.getElementById('sessionCountdown');
  if(!el) return;
  el.textContent = (Math.max(0, market.sessionNextAt - Date.now())/1000).toFixed(1)+'с';
}

export function doBuyOffer(o, silent){
  if(S.rub < o.price){ if(!silent) notify('Недостаточно денег'); return; }
  S.rub -= o.price; S.totalSpent += o.price;
  const item = { id: S.nextId++, country: o.country, flag: o.flag, plate: o.plate, rarity: o.rarity, price: o.hypo, favorite: false };
  S.col.push(item);
  if(!S.bestNum || item.price > S.bestNum.price) S.bestNum = item;
  const idx = market.offers.findIndex(x => x.id === o.id);
  if(idx >= 0) market.offers.splice(idx,1);
  Sound.buy(); haptic(15);
  if(silent) addAcctLog('🤖 Куплено: ' + o.plate + ' за ' + o.price.toLocaleString('ru-RU') + ' ₽', 'ok');
  else notify('Куплено: ' + o.plate + ' за ' + o.price.toLocaleString('ru-RU') + ' ₽');
  S.acct.deals++;
  S.acct.profit += (o.hypo - o.price);
  updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements();
  save();
}

export function doFulfillOrder(orderId, numId, silent){
  const o = market.orders.find(x => x.id === orderId);
  if(!o) return;
  const num = S.col.find(n => n.id === numId);
  if(!num) return;
  if(!plateMatchesMask(num.plate, o.mask)){ if(!silent) notify('Не подходит под маску'); return; }
  const reward = o.reward;
  S.rub += reward; S.totalEarned += reward;
  const idx = S.col.findIndex(n => n.id === numId);
  if(idx >= 0) S.col.splice(idx, 1);
  const oIdx = market.orders.findIndex(x => x.id === orderId);
  if(oIdx >= 0) market.orders.splice(oIdx,1);
  Sound.coin_big(); haptic([20,20,40]);
  S.acct.deals++;
  S.acct.profit += reward;
  if(silent) addAcctLog('🤖 Заказ выполнен: +' + reward.toLocaleString('ru-RU') + ' ₽', 'ok');
  else notify('🎯 Заказ выполнен: +' + reward.toLocaleString('ru-RU') + ' ₽');
  updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements();
  save();
}
