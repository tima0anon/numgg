import { RARITY, RARITY_ORDER } from '../../config/rarity.js';
import { COUNTRIES, extractRegion } from '../../domain/plates/countries.js';
import { isRecentPlate, rememberPlate } from '../../domain/memory.js';
import { hypoPrice } from '../../domain/pricing.js';
import { rnd } from '../../domain/random.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';

export const UP_RTP = 0.88;
export const UP_MIN_CHANCE = 0.05;
export const UP_MAX_CHANCE = 0.75;
export const UP_MAX_STAKE = 6;

export function plateWorth(n){
  if(!n) return 0;
  const region = n.region || extractRegion(n.plate, n.flag);
  return hypoPrice(n.rarity, n.flag, region, n.plate);
}

export function quoteChance(sum, price){
  if(!(sum > 0) || !(price > 0)) return 0;
  return (sum * UP_RTP) / price;
}

function rarityNear(want){
  const ranked = RARITY
    .map(r => ({ id: r.id, d: Math.abs(Math.log((r.price * 0.72) / Math.max(1, want))) }))
    .sort((a, b) => a.d - b.d);
  const roll = Math.random();
  const idx = roll < 0.62 ? 0 : roll < 0.86 ? 1 : 2;
  return ranked[Math.min(idx, ranked.length - 1)].id;
}

function samplePlate(rid){
  const cd = rnd(COUNTRIES);
  let res = cd.gen(rid);
  for(let i = 0; i < 10; i++){
    res = cd.gen(rid);
    if(!isRecentPlate(res.plate, cd.flag)) break;
  }
  const region = extractRegion(res.plate, cd.flag);
  const price = hypoPrice(rid, cd.flag, region, res.plate);
  return { country: cd.name, flag: cd.flag, plate: res.plate, rarity: rid, price, region, favorite: false };
}

export function findTarget(sum, wantChance, bestRarity){
  if(!(sum > 0)) return null;
  const want = sum * UP_RTP / wantChance;
  const bestIdx = RARITY_ORDER.indexOf(bestRarity);
  let best = null;
  let bestScore = Infinity;
  for(let i = 0; i < 42; i++){
    const sample = samplePlate(rarityNear(want));
    const chance = quoteChance(sum, sample.price);
    const richer = sample.price >= Math.round(sum * 1.08);
    const rarer = RARITY_ORDER.indexOf(sample.rarity) > bestIdx;
    if(!richer && !rarer) continue;
    if(chance < UP_MIN_CHANCE || chance > UP_MAX_CHANCE) continue;
    const score = Math.abs(chance - wantChance) + Math.abs(Math.log(sample.price / want)) * 0.12;
    if(score < bestScore){ bestScore = score; best = sample; }
  }
  if(best) rememberPlate(best.plate, best.flag);
  return best;
}

function snapshot(target){
  return {
    country: target.country,
    flag: target.flag,
    plate: target.plate,
    rarity: target.rarity,
    price: target.price,
    region: target.region || null,
  };
}

export function beginRoll(ids, target){
  if(!target || !target.plate) return { error: 'Сначала подбери цель.' };
  const want = new Set(ids.map(id => Number(id)));
  const stakes = [];
  S.col.forEach(n => {
    if(want.has(Number(n.id)) && !n.listed && !n.favorite) stakes.push(n);
  });
  if(!stakes.length) return { error: 'Выбери номера из гаража. Избранное и лоты с биржи не ставятся.' };
  if(stakes.length > UP_MAX_STAKE) return { error: 'За раз можно поставить не больше шести номеров.' };
  const sum = stakes.reduce((s, n) => s + plateWorth(n), 0);
  const livePrice = plateWorth(target);
  const chance = quoteChance(sum, livePrice);
  const bestIdx = Math.max(...stakes.map(n => RARITY_ORDER.indexOf(n.rarity)));
  const richer = livePrice >= Math.round(sum * 1.08);
  const rarer = RARITY_ORDER.indexOf(target.rarity) > bestIdx;
  if(!richer && !rarer) return { error: 'Цель уже не дороже ставки. Подбери другой номер.' };
  if(chance < UP_MIN_CHANCE || chance > UP_MAX_CHANCE) return { error: 'По текущему рынку шанс вышел за края. Подвинь ползунок.' };
  const stakeIds = stakes.map(n => n.id);
  S.col = S.col.filter(n => !stakeIds.includes(n.id));
  const fresh = Object.assign(snapshot(target), { price: livePrice });
  const win = Math.random() < chance;
  if(!S.upgraderStats) S.upgraderStats = { spins: 0, wins: 0 };
  S.upgraderStats.spins = (S.upgraderStats.spins || 0) + 1;
  S.upgraderPending = {
    win,
    chance,
    stakeValue: sum,
    stakeCount: stakes.length,
    target: fresh,
  };
  save();
  return { win, chance, sum, stakes, target: fresh };
}

function grant(target, stakeValue){
  const num = {
    id: S.nextId++,
    country: target.country,
    flag: target.flag,
    plate: target.plate,
    rarity: target.rarity,
    price: target.price,
    region: target.region || extractRegion(target.plate, target.flag),
    favorite: false,
    listed: false,
    bought: Math.round(stakeValue),
  };
  S.col.push(num);
  S.rarityCount[num.rarity] = (S.rarityCount[num.rarity] || 0) + 1;
  if(!S.bestNum || num.price > S.bestNum.price) S.bestNum = num;
  return num;
}

function pushLog(pending){
  if(!Array.isArray(S.upgraderLog)) S.upgraderLog = [];
  S.upgraderLog.unshift({
    win: !!pending.win,
    plate: pending.target.plate,
    flag: pending.target.flag,
    rarity: pending.target.rarity,
    price: pending.target.price,
    chance: pending.chance,
    stakeValue: pending.stakeValue,
    stakeCount: pending.stakeCount,
    ts: Date.now(),
  });
  if(S.upgraderLog.length > 12) S.upgraderLog.length = 12;
}

export function settleUpgrader(){
  const pending = S.upgraderPending;
  if(!pending || !pending.target) { S.upgraderPending = null; return null; }
  S.upgraderPending = null;
  if(pending.win){
    grant(pending.target, pending.stakeValue || 0);
    if(!S.upgraderStats) S.upgraderStats = { spins: 0, wins: 0 };
    S.upgraderStats.wins = (S.upgraderStats.wins || 0) + 1;
  }
  pushLog(pending);
  save();
  return pending;
}
