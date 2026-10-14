import {
  NEWS_LIFE_RANGE,
  NEWS_MAX_ACTIVE,
  NEWS_MIN_LIFE,
} from '../../config/constants.js';
import { COUNTRY_FLAGS } from '../../config/economy.js';
import { RMAP } from '../../config/rarity.js';
import { rnd } from '../../domain/random.js';
import { tapeAt } from '../../domain/newsTape.js';
import { renderExchange } from '../exchange/view.js';
import { renderCollection } from '../garage/view.js';
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
  {type:'region', target:'97', mult:1.55, title:'Ажиотаж вокруг 97-го региона', desc:'Московские блатные серии 97 резко выросли.', kind:'bull'},
  {type:'region', target:'99', mult:1.6, title:'99-й регион снова в топе', desc:'Премиальные московские номера дорожают.', kind:'bull'},
  {type:'region', target:'77', mult:1.45, title:'77-й регион дорожает', desc:'Москва — традиционный лидер спроса.', kind:'bull'},
  {type:'region', target:'77', mult:0.72, title:'Перенасыщение рынка 77 региона', desc:'Слишком много предложений — цены падают.', kind:'bear'},
  {type:'region', target:'199', mult:1.5, title:'199-й регион интересует коллекционеров', desc:'Редкий регион набирает цену.', kind:'bull'},
  {type:'rarity', target:'epic', mult:1.20, title:'Мода на эпические серии', desc:'Эпические номера растут в цене.', kind:'bull'},
  {type:'rarity', target:'legendary', mult:1.30, title:'Охота за легендарками', desc:'Легендарные номера разлетаются с наценкой.', kind:'bull'},
  {type:'rarity', target:'mythic', mult:1.25, title:'Мифические лоты в дефиците', desc:'Мифы уходят по завышенным ценам.', kind:'bull'},
  {type:'rarity', target:'divine', mult:1.40, title:'Божественные номера бьют рекорды', desc:'Спрос на божественные лоты зашкаливает.', kind:'bull'},
  {type:'rarity', target:'common', mult:0.80, title:'Мусорный рынок обвалился', desc:'Обычные номера почти ничего не стоят.', kind:'bear'},
  {type:'global', target:'all', mult:1.10, title:'Мировой бум коллекционирования', desc:'Все категории номеров немного подорожали.', kind:'bull'},
  {type:'global', target:'all', mult:0.92, title:'Глобальный экономический спад', desc:'Все категории номеров просели.', kind:'bear'},
  {type:'global', target:'all', mult:0.88, title:'Паника на рынках', desc:'Инвесторы выводят деньги из коллекционных активов.', kind:'bear'},
  {type:'country', target:'ua', mult:1.28, title:'Киев: очередь за красивыми сериями', desc:'Украинские номера внезапно разбирают.', kind:'bull'},
  {type:'country', target:'ua', mult:0.78, title:'Украина: покупатели ждут', desc:'Без спроса украинские лоты стоят неделями.', kind:'bear'},
  {type:'country', target:'ru', mult:1.32, title:'Москва скупает короткие серии', desc:'Российские номера уходят даже чуть выше рынка.', kind:'bull'},
  {type:'country', target:'ru', mult:0.8, title:'Россия: сезон затишья', desc:'Дилеры не берут российские номера по обычной цене.', kind:'bear'},
  {type:'country', target:'by', mult:1.24, title:'Минск поднял интерес к сериям', desc:'Белорусские номера получили живой спрос.', kind:'bull'},
  {type:'country', target:'cn', mult:1.36, title:'Шанхай платит премию за восьмёрки', desc:'Китайский спрос тянет цену и скорость продажи.', kind:'bull'},
  {type:'country', target:'us', mult:1.26, title:'Калифорния: vanity снова в моде', desc:'Американские номера берут быстрее обычного.', kind:'bull'},
  {type:'country', target:'us', mult:0.84, title:'США: аукционы пустые', desc:'Американские лоты почти не смотрят.', kind:'bear'},
  {type:'region', target:'777', mult:1.7, title:'777-й регион в ленте коллекционеров', desc:'Редкие российские регионы берут с наценкой.', kind:'bull'},
  {type:'region', target:'199', mult:1.48, title:'199-й регион ищут в чатах', desc:'Спрос точечный, но живой.', kind:'bull'},
  {type:'region', target:'01', mult:1.42, title:'Адыгея: серия 01 подорожала', desc:'Региональный спрос поднял ликвидность.', kind:'bull'},
  {type:'region', target:'02', mult:0.7, title:'02 регион переполнен', desc:'Лишние предложения давят на цену.', kind:'bear'},
  {type:'rarity', target:'rare', mult:1.2, title:'Редкие серии в дефиците', desc:'Редкие номера продаются заметно легче.', kind:'bull'},
  {type:'rarity', target:'uncommon', mult:0.84, title:'Необычные серии надоели рынку', desc:'Их берут только со скидкой.', kind:'bear'},
  {type:'global', target:'all', mult:1.16, title:'Выходные: все смотрят биржу', desc:'Общий спрос выше, дорогие лоты тоже смотрят.', kind:'bull'},
  {type:'country', target:'ru', mult:1.22, title:'Дилеры открыли закупку по России', desc:'Российские серии берут живее обычного.', kind:'bull'},
  {type:'country', target:'by', mult:1.18, title:'Брест разобрал белорусские серии', desc:'Спрос на Беларусь вырос за вечер.', kind:'bull'},
  {type:'country', target:'ua', mult:1.21, title:'Одесса ищет ровные серии', desc:'Украинские номера получили вторую волну спроса.', kind:'bull'},
  {type:'country', target:'cn', mult:1.27, title:'Пекин платит за зеркальные цифры', desc:'Китайские лоты уходят с наценкой.', kind:'bull'},
  {type:'country', target:'us', mult:1.19, title:'Техас поднял vanity', desc:'Американские номера снова ликвидны.', kind:'bull'},
  {type:'region', target:'78', mult:1.34, title:'Петербург, 78 регион, в спросе', desc:'Северо-западные серии подорожали.', kind:'bull'},
  {type:'region', target:'116', mult:1.28, title:'Татарстан, 116, разбирают', desc:'Региональные коллекционеры подняли цену.', kind:'bull'},
  {type:'region', target:'150', mult:1.33, title:'Подмосковье, 150, пошло вверх', desc:'Лоты 150 региона смотрят чаще.', kind:'bull'},
  {type:'rarity', target:'epic', mult:1.18, title:'Эпики снова в чатах', desc:'Эпические серии берут без долгой торговли.', kind:'bull'},
  {type:'rarity', target:'legendary', mult:1.24, title:'Легенды не залеживаются', desc:'На легендарные номера нашёлся живой спрос.', kind:'bull'},
  {type:'global', target:'all', mult:1.12, title:'Вечерний спрос на всю доску', desc:'Покупатели смотрят и обычные, и дорогие лоты.', kind:'bull'},
  {type:'country', target:'ru', mult:0.83, title:'Россия: дилеры взяли паузу', desc:'Российские лоты стоят дольше.', kind:'bear'},
  {type:'country', target:'cn', mult:0.86, title:'Китай закрыл часть торгов', desc:'Китайские номера охладели.', kind:'bear'},
  {type:'region', target:'78', mult:0.76, title:'78 регион переполнен', desc:'Петербургских серий слишком много.', kind:'bear'},
  {type:'region', target:'97', mult:0.74, title:'97 регион выдохся', desc:'Премия на 97-й временно спала.', kind:'bear'},
  {type:'rarity', target:'rare', mult:0.86, title:'Редкие серии застоялись', desc:'Редкие номера берут только с уступкой.', kind:'bear'},
  {type:'global', target:'all', mult:0.9, title:'Тихий понедельник', desc:'Общий спрос чуть ниже обычного.', kind:'bear'}
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
export function renderTape(){
  const el = document.getElementById('marketTape');
  if(!el) return;
  const now = Date.now();
  const items = S.news.filter(n => n.until > now);
  if(!items.length){
    el.innerHTML = '<span class="tape-quiet">Рынок тихий. Шанс продажи за минуту всё равно есть, новость его поднимает.</span>';
    return;
  }
  el.innerHTML = items.map(n => {
    const shown = n.type === 'region' ? 1 + (n.mult - 1) * 1.8 : n.mult;
    const pct = Math.round((shown - 1) * 100);
    const sign = pct >= 0 ? '+' : '';
    return '<span class="tape-item '+(pct >= 0 ? 'up' : 'down')+'">'+targetLabel(n)+' '+sign+pct+'% спрос</span>';
  }).join('');
}

function refreshBoards(){
  renderTape();
  renderCollection();
  renderExchange();
}

export function renderNews(){
  renderTape();
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
  if(S.news.length !== before){ applyTape(now); return; }
  box.querySelectorAll('[data-news-id]').forEach(el => {
    const n = S.news.find(x => x.id === el.dataset.newsId);
    if(!n) return;
    const timeEl = el.querySelector('.ntime');
    if(timeEl) timeEl.textContent = '⏳ ' + formatTimeLeft(n.until - now);
  });
}

let localNews = [];

export function injectNews(kind){
  const pool = NEWS_TEMPLATES.filter(t => t.kind === kind);
  const tpl = pool.length ? rnd(pool) : null;
  if(!tpl) return;
  const now = Date.now();
  localNews = localNews.filter(n => n.until > now);
  if(localNews.length >= 2) localNews.shift();
  let durMs = NEWS_MIN_LIFE + ~~(Math.random()*NEWS_LIFE_RANGE);
  if(tpl.kind === 'bear') durMs = Math.round(durMs * 1.75);
  localNews.push({
    id: 'local' + now,
    type: tpl.type, target: tpl.target, mult: tpl.mult,
    title: tpl.title, desc: tpl.desc, kind: tpl.kind,
    until: now + durMs, startedAt: now
  });
  applyTape(now);
}

function sameTape(a, b){
  if(a.length !== b.length) return false;
  for(let i = 0; i < a.length; i++) if(!b[i] || a[i].id !== b[i].id) return false;
  return true;
}

function applyTape(now){
  localNews = localNews.filter(n => n.until > now);
  const next = tapeAt(now, NEWS_TEMPLATES).concat(localNews).slice(-NEWS_MAX_ACTIVE);
  const same = sameTape(S.news, next);
  S.news = next;
  if(!same){
    renderNews();
    refreshBoards();
  }
}

export function generateNews(){
  applyTape(Date.now());
}
