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
    let delta = (news.mult || 1) - 1;
    if(news.type === 'region') delta *= 1.8;
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

export function saleChance(price, hypo, mood){
  const fair = Math.max(1, hypo);
  const dev = (price - fair) / fair;
  const heat = mood?.heat ?? 0.2;
  let chance = 0.46 + (heat - 0.2) * 0.55;
  if(dev < 0) chance += Math.min(0.22, -dev * 1.05);
  else chance -= Math.min(0.4, dev * 0.5);
  if(mood?.bull) chance += 0.12;
  return Math.max(0.16, Math.min(0.88, chance));
}

export function saleHint(chance, price, hypo, mood){
  const dev = (price - hypo) / Math.max(1, hypo);
  if(mood?.bull && chance >= 0.62) return 'Новость подняла спрос: рулетка каждые 15 секунд крутится с этим шансом';
  if(dev > 0.05) return 'Цена выше рынка, шанс меньше, но круг всё равно есть';
  if(chance >= 0.62) return 'Спрос живой: часто хватает одного или двух кругов';
  if(chance >= 0.38) return 'Обычный спрос. Несколько кругов, и номер обычно забирают';
  return 'Рынок холодный, но рулетка крутится каждые 15 секунд';
}
