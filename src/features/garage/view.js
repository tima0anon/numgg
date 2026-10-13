import {
  RARITY_ORDER,
  RMAP,
} from '../../config/rarity.js';
import { SOCIAL_PAUSED } from '../../config/constants.js';
import { extractRegion } from '../../domain/plates/countries.js';
import { describePlate } from '../../domain/plates/market.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { marketMood, saleChance, saleHint } from '../../domain/demand.js';
import { hypoPrice } from '../../domain/pricing.js';
import { bulkCost } from '../drop/spin.js';
import { renderExchange } from '../exchange/view.js';
import {
  bulkQuote,
  sellHigh,
  sellLow,
  sellMid,
} from './sell.js';
import { sendPlate, readSession } from '../../services/remote.js';
import { Sound } from '../../services/audio.js';
import { copyText } from '../../services/clipboard.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

// GARAGE
export function renderCountries(){
  const sel = document.getElementById('fCountry'); if(!sel) return;
  const cur = sel.value;
  const countries = [...new Set(S.col.map(n => n.country))].sort();
  sel.innerHTML = '<option value="all">Все страны</option>' + countries.map(c => '<option value="'+c+'">'+c+'</option>').join('');
  sel.value = (countries.includes(cur) || cur==='all') ? cur : 'all';
}

function livePrice(n){
  return hypoPrice(n.rarity, n.flag, extractRegion(n.plate, n.flag), n.plate);
}

function deltaHtml(ask, bought){
  if(typeof bought !== 'number') return '';
  const d = Math.round(ask - bought);
  const up = d >= 0;
  return '<span class="pnl '+(up?'up':'down')+'">'+(up?'+':'−')+Math.abs(d).toLocaleString('ru-RU')+'</span>';
}

export function getFiltered(){
  const country = document.getElementById('fCountry').value;
  const rarity = document.getElementById('fRarity').value;
  const minPrice = parseInt(document.getElementById('fPrice').value) || 0;
  const search = document.getElementById('fSearch').value.toLowerCase().trim();
  const sortBy = document.getElementById('fSort').value;
  const filtered = S.col.filter(n => {
    if(country!=='all' && n.country!==country) return false;
    if(rarity!=='all' && n.rarity!==rarity) return false;
    if(livePrice(n) < minPrice) return false;
    if(search && !n.plate.toLowerCase().includes(search)) return false;
    return true;
  });
  switch(sortBy){
    case 'price-desc': filtered.sort((a,b)=>livePrice(b)-livePrice(a)||b.id-a.id); break;
    case 'price-asc': filtered.sort((a,b)=>livePrice(a)-livePrice(b)||b.id-a.id); break;
    case 'rarity-desc': filtered.sort((a,b)=>RARITY_ORDER.indexOf(b.rarity)-RARITY_ORDER.indexOf(a.rarity)||livePrice(b)-livePrice(a)); break;
    case 'rarity-asc': filtered.sort((a,b)=>RARITY_ORDER.indexOf(a.rarity)-RARITY_ORDER.indexOf(b.rarity)||livePrice(b)-livePrice(a)); break;
    case 'new': filtered.sort((a,b)=>b.id-a.id); break;
    case 'old': filtered.sort((a,b)=>a.id-b.id); break;
    default: filtered.sort((a,b) => { if(!!a.listed !== !!b.listed) return a.listed ? -1 : 1; if(!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1; return b.id - a.id; });
  }
  return filtered;
}

export function updateGarageSummary(){
  const el = document.getElementById('garageSummary'); if(!el) return;
  if(!S.col.length){ el.innerHTML = ''; return; }
  const totalHypo = S.col.reduce((s,n) => s + hypoPrice(n.rarity, n.flag, extractRegion(n.plate, n.flag), n.plate), 0);
  el.innerHTML = '💼 Оценка: <b>' + totalHypo.toLocaleString('ru-RU') + ' ₽</b> · уникальных: <b>' + new Set(S.col.map(n=>n.plate+'|'+n.flag)).size + '</b> · на бирже: <b>' + market.listings.length + '</b>';
}

function syncListed(){
  const ids = new Set(market.listings.map(l => Number(l.numId)));
  for(const n of S.col) n.listed = ids.has(Number(n.id));
}

async function givePlate(id){
  if(!readSession()){ notify('Чтобы передать номер, войди на вкладке «Рейтинг»'); Sound.error(); return; }
  const num = S.col.find(n => n.id === id);
  if(!num || num.listed){ notify('Сначала сними номер с продажи'); return; }
  const to = prompt('Ник, кому отдать ' + num.plate);
  if(!to) return;
  try {
    await sendPlate(to.trim(), { plate: num.plate, flag: num.flag, country: num.country, rarity: num.rarity, price: livePrice(num), bought: num.bought || 0, region: num.region || extractRegion(num.plate, num.flag) });
    const idx = S.col.findIndex(n => n.id === id);
    if(idx >= 0) S.col.splice(idx, 1);
    save(); renderCollection();
    notify('Номер отправлен игроку ' + to.trim());
  } catch(error){
    notify(error.message || 'Не удалось передать номер');
    Sound.error();
  }
}

export function renderCollection(){
  syncListed();
  renderCountries();
  document.getElementById('colCount').textContent = S.col.length;
  const favTotal = S.col.filter(n => n.favorite).length;
  document.getElementById('favCount').textContent = favTotal ? ' · ⭐ '+favTotal : '';
  updateGarageSummary();
  const quote = bulkQuote();
  const lowBtn = document.getElementById('sellAllLow');
  const midBtn = document.getElementById('sellAllMid');
  const highBtn = document.getElementById('sellAllHigh');
  if(lowBtn && midBtn && highBtn){
    const empty = quote.count === 0;
    lowBtn.disabled = empty;
    midBtn.disabled = empty;
    highBtn.disabled = empty;
    document.getElementById('sellAllLowPrice').textContent = empty ? '—' : quote.count + ' · ' + quote.low.toLocaleString('ru-RU');
    document.getElementById('sellAllMidPrice').textContent = empty ? '—' : quote.count + ' · ' + quote.mid.toLocaleString('ru-RU');
    document.getElementById('sellAllHighPrice').textContent = empty ? '—' : quote.count + ' · ' + quote.high.toLocaleString('ru-RU');
  }
  const grid = document.getElementById('grid');
  const items = getFiltered();
  if(!S.col.length){ grid.innerHTML = '<div class="empty">Коллекция пуста — дропни за '+bulkCost(1)+' ₽</div>'; return; }
  if(!items.length){ grid.innerHTML = '<div class="empty">По этому фильтру ничего нет.</div>'; return; }
  const MAX = 500;
  const slice = items.length > MAX ? items.slice(0, MAX) : items;
  const coefLow = Math.max(10, Math.min(90, S.coefLow)) / 100;
  const coefHigh = Math.max(1, Math.min(200, S.coefHigh)) / 100;
  grid.innerHTML = slice.map(n => {
    const R = RMAP[n.rarity];
    const hypo = hypoPrice(n.rarity, n.flag, extractRegion(n.plate, n.flag), n.plate);
    const lowP = Math.max(1, Math.round(hypo * (1 - coefLow)));
    const midP = Math.max(1, Math.round(hypo));
    const highP = Math.max(1, Math.round(hypo * (1 + coefHigh)));
    const listing = market.listings.find(l => Number(l.numId) === Number(n.id));
    const listed = !!listing;
    const bought = typeof n.bought === 'number' ? n.bought : null;
    const boughtLine = bought == null
      ? '<div class="bought-line">Цена покупки не записана</div>'
      : '<div class="bought-line">Купил за '+bought.toLocaleString('ru-RU')+' ₽ · '+(hypo-bought>=0?'+':'−')+Math.abs(hypo-bought).toLocaleString('ru-RU')+' к рынку</div>';
    const corner = bought != null ? deltaHtml(listed ? listing.price : midP, bought) : '';
    const region = extractRegion(n.plate, n.flag);
    const mood = marketMood(n.flag, region, n.rarity);
    const chance = listing ? saleChance(listing.price, hypo, mood, n.rarity) : 0;
    const favClass = n.favorite ? ' favorite' : '';
    const star = n.favorite ? '⭐' : '☆';
    const lot = listing
      ? '<div class="lot-state"><b>На продаже · '+listing.price.toLocaleString('ru-RU')+' ₽</b><span class="demand '+mood.cls+'"><span class="roulette">⟳</span> шанс '+Math.round(chance*100)+'% за эту минуту</span><span class="lot-why">'+saleHint(chance, listing.price, hypo, mood)+'</span></div>'
      : '';
    return '<div class="ncard '+n.rarity+favClass+(listed?' listed':'')+'">'+
      corner+
      '<div class="plate-stage copy-plate" data-plate="'+n.plate+'" title="Нажми, чтобы скопировать">'+renderRealPlate(n.plate, n.flag, '')+'</div>'+
      '<div class="card-meta"><span class="who">'+n.country+'</span><span class="row-right">'+
      '<span class="rar '+n.rarity+'">'+R.name+'</span>'+
      '<button class="fav-btn'+(n.favorite?' active':'')+'" data-fav="'+n.id+'">'+star+'</button></span></div>'+
      '<div class="card-price">'+hypo.toLocaleString('ru-RU')+' ₽<span>рыночная цена</span></div>'+
      '<div class="bought-line">'+describePlate(n.plate, n.flag, region, n.rarity)+'</div>'+
      boughtLine+
      lot+
      (listed
        ? '<button class="sell-btn" style="background:var(--red);color:#fff;border:none;border-radius:100px;padding:10px;cursor:pointer;font-weight:700;font-family:var(--font)" data-unlist="'+n.id+'">Снять с продажи</button>'
        : '<div class="sell-trio">'+
          '<button class="sell-low" data-low="'+n.id+'"><span class="lb">Сразу</span><span class="pr">'+lowP.toLocaleString('ru-RU')+'</span>'+deltaHtml(lowP, bought)+'</button>'+
          '<button class="sell-mid" data-mid="'+n.id+'"><span class="lb">По рынку</span><span class="pr">'+midP.toLocaleString('ru-RU')+'</span>'+deltaHtml(midP, bought)+'</button>'+
          '<button class="sell-high" data-high="'+n.id+'"><span class="lb">Дороже</span><span class="pr">'+highP.toLocaleString('ru-RU')+'</span>'+deltaHtml(highP, bought)+'</button>'+
          '</div>' + (SOCIAL_PAUSED ? '' : '<button type="button" class="ios-btn gray give-btn" data-give="'+n.id+'">Передать по нику</button>')
      )+
      '</div>';
  }).join('') + (items.length > MAX ? '<div class="empty">Показаны первые '+MAX+' из '+items.length+'. Сузь фильтр, чтобы увидеть остальные.</div>' : '');
  grid.querySelectorAll('[data-give]').forEach(b => b.addEventListener('click', e => givePlate(parseInt(e.currentTarget.dataset.give,10))));
  grid.querySelectorAll('[data-low]').forEach(b => b.addEventListener('click', e => sellLow(parseInt(e.currentTarget.dataset.low,10))));
  grid.querySelectorAll('[data-mid]').forEach(b => b.addEventListener('click', e => sellMid(parseInt(e.currentTarget.dataset.mid,10))));
  grid.querySelectorAll('[data-high]').forEach(b => b.addEventListener('click', e => sellHigh(parseInt(e.currentTarget.dataset.high,10))));
  grid.querySelectorAll('[data-unlist]').forEach(b => b.addEventListener('click', e => {
    const id = parseInt(e.currentTarget.dataset.unlist,10);
    const num = S.col.find(n => n.id === id);
    if(num) num.listed = false;
    const idx = market.listings.findIndex(l => l.numId === id);
    if(idx >= 0) market.listings.splice(idx,1);
    renderCollection(); renderExchange(); save(); notify('Лот снят с биржи');
  }));
  grid.querySelectorAll('.fav-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.fav,10);
    const num = S.col.find(n => n.id === id);
    if(!num) return;
    num.favorite = !num.favorite;
    Sound.click(); save(); renderCollection();
  }));
  grid.querySelectorAll('.copy-plate').forEach(el => el.addEventListener('click', e => {
    if(e.target.closest('button')) return;
    const p = e.currentTarget.dataset.plate;
    if(copyText(p)){ notify('📋 '+p); Sound.click(); }
  }));
}
