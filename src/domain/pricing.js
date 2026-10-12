import {
  countryMult,
  regionMult,
} from '../config/economy.js';
import { RMAP } from '../config/rarity.js';
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

export function hypoPrice(rarity, flag, region){
  const base = RMAP[rarity].price;
  return Math.max(1, Math.round(base * countryMult(flag) * regionMult(region) * newsMult(flag, region, rarity)));
}
