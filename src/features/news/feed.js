import {
  NEWS_LIFE_RANGE,
  NEWS_MAX_ACTIVE,
  NEWS_MIN_LIFE,
} from '../../config/constants.js';
import { COUNTRY_FLAGS } from '../../config/economy.js';
import { RMAP } from '../../config/rarity.js';
import { rnd } from '../../domain/random.js';
import { addAcctLog } from '../accountant/session.js';
import { S } from '../../state/player.js';

// NEWS - SLOW + NO BLINK
export const NEWS_TEMPLATES = [
  {type:'country', target:'ru', mult:1.25, title:'Правительство РФ повышает статус блатных серий', desc:'Спрос на российские премиум-номера вырос.', kind:'bull'},
  {type:'country', target:'ru', mult:0.85, title:'Волна проверок водителей в России', desc:'Осторожные покупатели уходят с рынка.', kind:'bear'},
  {type:'country', target:'cn', mult:1.30, title:'Китайские бизнесмены скупают красивые номера', desc:'Спрос из Азии подбрасывает цены на китайские серии.', kind:'bull'},
  {type:'country', target:'cn', mult:0.88, title:'Регуляторы КНР ужесточили правила', desc:'Китайский рынок номеров охлаждается.', kind:'bear'},
  {type:'country', target:'us', mult:1.22, title:'Vanity-номера в моде в США', desc:'Американские коллекционные номера подорожали.', kind:'bull'},
  {type:'country', target:'us', mult:0.90, title:'Скандал на аукционах США', desc:'Доверие к американским лотам падает.', kind:'bear'},
  {type:'country', target:'ua', mult:1.18, title:'Украинский рынок оживает', desc:'Интерес к украинским номерам растёт.', kind:'bull'},
  {type:'country', target:'ua', mult:0.82, title:'Проблемы на украинских торгах', desc:'Спрос на украинские номера упал.', kind:'bear'},
  {type:'country', target:'by', mult:1.20, title:'Белорусские коллекционеры активизировались', desc:'Белорусские номера пошли вверх.', kind:'bull'},
  {type:'country', target:'by', mult:0.85, title:'Беларусь: снижение интереса', desc:'Белорусские лоты подешевели.', kind:'bear'},
  {type:'region', target:'97', mult:1.35, title:'Ажиотаж вокруг 97-го региона', desc:'Московские блатные серии 97 резко выросли.', kind:'bull'},
  {type:'region', target:'99', mult:1.35, title:'99-й регион снова в топе', desc:'Премиальные московские номера дорожают.', kind:'bull'},
  {type:'region', target:'77', mult:1.20, title:'77-й регион дорожает', desc:'Москва — традиционный лидер спроса.', kind:'bull'},
  {type:'region', target:'77', mult:0.85, title:'Перенасыщение рынка 77 региона', desc:'Слишком много предложений — цены падают.', kind:'bear'},
  {type:'region', target:'199', mult:1.22, title:'199-й регион интересует коллекционеров', desc:'Редкий регион набирает цену.', kind:'bull'},
  {type:'rarity', target:'epic', mult:1.20, title:'Мода на эпические серии', desc:'Эпические номера растут в цене.', kind:'bull'},
  {type:'rarity', target:'legendary', mult:1.30, title:'Охота за легендарками', desc:'Легендарные номера разлетаются с наценкой.', kind:'bull'},
  {type:'rarity', target:'mythic', mult:1.25, title:'Мифические лоты в дефиците', desc:'Мифы уходят по завышенным ценам.', kind:'bull'},
  {type:'rarity', target:'divine', mult:1.40, title:'Божественные номера бьют рекорды', desc:'Спрос на божественные лоты зашкаливает.', kind:'bull'},
  {type:'rarity', target:'common', mult:0.80, title:'Мусорный рынок обвалился', desc:'Обычные номера почти ничего не стоят.', kind:'bear'},
  {type:'global', target:'all', mult:1.10, title:'Мировой бум коллекционирования', desc:'Все категории номеров немного подорожали.', kind:'bull'},
  {type:'global', target:'all', mult:0.92, title:'Глобальный экономический спад', desc:'Все категории номеров просели.', kind:'bear'},
  {type:'global', target:'all', mult:0.88, title:'Паника на рынках', desc:'Инвесторы выводят деньги из коллекционных активов.', kind:'bear'}
];

export function kindClass(k){ return k==='bull'?'bull':k==='bear'?'bear':'warn'; }

export function formatTimeLeft(ms){
  const sec = Math.max(0, Math.floor(ms/1000));
  if(sec >= 60) return Math.floor(sec/60)+'м '+(sec%60)+'с';
  return sec+'с';
}

export function targetLabel(n){
  if(n.type==='country') return COUNTRY_FLAGS[n.target] || n.target;
  if(n.type==='region') return '📍 Регион '+n.target;
  if(n.type==='rarity') return '⭐ '+(RMAP[n.target] ? RMAP[n.target].name : n.target);
  return '🌍 Весь рынок';
}

// Incremental news render — no blinking, no full re-render
export function renderNews(){
  const box = document.getElementById('newsList');
  if(!box) return;
  const now = Date.now();
  S.news = S.news.filter(n => n.until > now);

  if(!S.news.length){
    // Only set empty if not already
    if(!box.querySelector('.empty')){
      box.innerHTML = '<div class="empty">Сейчас на рынке затишье. Следующие события появятся в ближайшее время.</div>';
    }
    return;
  }
  // Remove empty placeholder
  const emptyEl = box.querySelector('.empty');
  if(emptyEl) emptyEl.remove();

  // Track existing elements by id
  const existing = new Map();
  box.querySelectorAll('[data-news-id]').forEach(el => existing.set(el.dataset.newsId, el));

  // Remove stale cards
  const validIds = new Set(S.news.map(n => n.id));
  existing.forEach((el, id) => {
    if(!validIds.has(id)){ el.remove(); existing.delete(id); }
  });

  // Add/update
  S.news.forEach(n => {
    const left = Math.max(0, n.until - now);
    const time = formatTimeLeft(left);
    let el = existing.get(n.id);
    if(el){
      // Just update the timer text — no rebuild!
      const timeEl = el.querySelector('.ntime');
      if(timeEl) timeEl.textContent = '⏳ ' + time;
    } else {
      // Create new
      const pct = Math.round((n.mult-1)*100);
      const sign = pct >= 0 ? '+' : '';
      el = document.createElement('div');
      el.dataset.newsId = n.id;
      el.className = 'newscard new-item ' + kindClass(n.kind);
      el.innerHTML =
        '<div class="nh"><div class="nt">'+n.title+'</div><div class="ntime">⏳ '+time+'</div></div>'+
        '<div class="nd">'+n.desc+'</div>'+
        '<div class="eff '+(pct>=0?'up':'down')+'">'+targetLabel(n)+' · '+sign+pct+'%</div>';
      box.appendChild(el);
      // Only animate once for this element
      el.addEventListener('animationend', () => el.classList.remove('new-item'), { once: true });
    }
  });
}

// Just updates timers, no DOM rebuild
export function updateNewsTimers(){
  const box = document.getElementById('newsList');
  if(!box) return;
  const now = Date.now();
  const before = S.news.length;
  S.news = S.news.filter(n => n.until > now);
  if(S.news.length !== before){ renderNews(); return; }
  box.querySelectorAll('[data-news-id]').forEach(el => {
    const n = S.news.find(x => x.id === el.dataset.newsId);
    if(!n) return;
    const timeEl = el.querySelector('.ntime');
    if(timeEl) timeEl.textContent = '⏳ ' + formatTimeLeft(n.until - now);
  });
}

export function generateNews(){
  const now = Date.now();
  S.news = S.news.filter(n => n.until > now);
  if(S.news.length >= NEWS_MAX_ACTIVE) return;

  // 45% chance per check (called every 40s)
  if(Math.random() < 0.45){
    // Avoid duplicate type+target
    let tpl, attempts = 0, exists = true;
    while(exists && attempts < 20){
      tpl = rnd(NEWS_TEMPLATES);
      exists = S.news.some(n => n.type===tpl.type && n.target===tpl.target);
      attempts++;
    }
    if(!exists){
      const durMs = NEWS_MIN_LIFE + ~~(Math.random()*NEWS_LIFE_RANGE);
      S.news.push({
        id: 'n' + now + '_' + (Math.random()*1e6|0),
        type: tpl.type, target: tpl.target, mult: tpl.mult,
        title: tpl.title, desc: tpl.desc, kind: tpl.kind,
        until: now + durMs, startedAt: now
      });
      addAcctLog('📰 ' + tpl.title, 'n');
      renderNews();
    }
  }
}
