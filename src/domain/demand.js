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
  const sentiment = heat - 0.2;
  heat = Math.max(0.05, Math.min(1.7, heat));
  if(sentiment < -0.05) bull = false;
  let label = 'Спрос слабый';
  let cls = 'cool';
  if(sentiment < -0.05){ label = 'Спрос упал'; cls = 'cold'; }
  else if(heat >= 0.85){ label = 'Ажиотаж'; cls = 'hot'; }
  else if(heat >= 0.5 || bull){ label = 'Спрос есть'; cls = 'warm'; }
  else if(heat <= 0.28){ label = 'Почти нет спроса'; cls = 'cold'; }
  return { heat, bull, sentiment, label, cls, titles };
}

const RARITY_DEMAND = { common:0, uncommon:0.008, rare:0.015, epic:0.025, legendary:0.035, mythic:0.045, divine:0.055 };

export function saleChance(price, hypo, mood, rarity){
  const fair = Math.max(1, hypo);
  const dev = (price - fair) / fair;
  const heatUp = Math.max(0, (mood?.heat ?? 0.2) - 0.2);
  let chance = 0.06 + heatUp * 0.08;
  if(dev < 0) chance += Math.min(0.04, -dev * 0.2);
  else chance -= Math.min(0.045, dev * 0.3);
  if(mood?.bull) chance += 0.02;
  const sentiment = mood?.sentiment || 0;
  if(sentiment < -0.05){
    const cut = Math.min(0.75, -sentiment * 1.35);
    chance *= (1 - cut);
  }
  chance = Math.max(0.02, Math.min(0.10, chance));
  chance += RARITY_DEMAND[rarity] || 0;
  return Math.max(0.02, Math.min(0.16, chance));
}

export function saleHint(chance, price, hypo, mood){
  const dev = (price - hypo) / Math.max(1, hypo);
  if(mood?.sentiment < -0.05) return 'Новость уронила спрос: шанс за эту минуту уже ниже';
  if(mood?.bull && chance >= 0.12) return 'Новость подняла спрос: этот шанс действует на текущую минуту';
  if(dev > 0.05) return 'Цена выше рынка, покупатели почти не смотрят';
  if(chance >= 0.12) return 'Редкий всплеск спроса. Такой шанс долго не держится';
  if(chance >= 0.06) return 'Обычный спрос. Номер может провисеть несколько минут';
  return 'Рынок холодный. Шанс крошечный, но он есть';
}
