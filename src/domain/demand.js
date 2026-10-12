import { S } from '../state/player.js';

function applies(news, flag, region, rarity){
  if(!news) return false;
  if(news.type === 'global') return true;
  if(news.type === 'country') return news.target === flag;
  if(news.type === 'region') return news.target === region;
  if(news.type === 'rarity') return news.target === rarity;
  return false;
}

export function marketMood(flag, region, rarity){
  const now = Date.now();
  let heat = 0.2;
  let bull = false;
  const titles = [];
  for(const news of S.news){
    if(!news || news.until <= now) continue;
    if(!applies(news, flag, region, rarity)) continue;
    const delta = (news.mult || 1) - 1;
    heat += delta;
    if(delta >= 0.08) bull = true;
    titles.push(news.title);
  }
  heat = Math.max(0.05, Math.min(1.7, heat));
  let label = 'Спрос слабый';
  let cls = 'cool';
  if(heat >= 0.85){ label = 'Ажиотаж'; cls = 'hot'; }
  else if(heat >= 0.5 || bull){ label = 'Спрос есть'; cls = 'warm'; }
  else if(heat <= 0.28){ label = 'Почти нет спроса'; cls = 'cold'; }
  return { heat, bull, label, cls, titles };
}

export function saleChance(price, hypo, mood, rarityIdx){
  const fair = Math.max(1, hypo);
  const dev = (price - fair) / fair;
  const heat = mood.heat;
  if(dev > 0.02 && !mood.bull) return 0;
  let chance;
  if(dev <= -0.10) chance = 0.28 + heat * 0.32;
  else if(dev < -0.02) chance = 0.06 + heat * 0.2;
  else if(dev <= 0.02) chance = 0.03 + heat * 0.22;
  else chance = Math.max(0, (heat - 0.22) * 1.35 - dev * 1.15);
  chance *= Math.max(0.4, 1 - (rarityIdx || 0) * 0.07);
  return Math.max(0, Math.min(0.92, chance));
}

export function saleHint(chance, price, hypo, mood){
  const dev = (price - hypo) / Math.max(1, hypo);
  if(dev > 0.02 && !mood.bull) return 'Дороже рынка не берут: нет хорошей новости по этому номеру';
  if(chance >= 0.55) return 'Покупатели активны, лот может уйти в ближайшее обновление';
  if(chance >= 0.2) return 'По обычной цене берут, но не с первого раза';
  if(chance > 0) return 'Рынок тихий: продажа возможна, но редкая';
  return 'Сейчас этот ценник никто не платит';
}
