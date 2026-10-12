import { appraisePlate } from './plates/market.js';
import { S } from '../state/player.js';

// PRICES
export function newsMult(flag, region, rarity){
  let m = 1;
  const now = Date.now();
  for(const n of S.news){
    if(n.until <= now) continue;
    if(n.type === 'global') m *= n.mult;
    else if(n.type === 'country' && n.target === flag) m *= n.mult;
    else if(n.type === 'region' && n.target === region) m *= 1 + (n.mult - 1) * 1.8;
    else if(n.type === 'rarity' && n.target === rarity) m *= n.mult;
  }
  return m;
}

export function hypoPrice(rarity, flag, region, plate){
  const quote = appraisePlate(plate, flag, region, rarity);
  return Math.max(1, Math.round(quote.price * newsMult(flag, region, rarity)));
}
