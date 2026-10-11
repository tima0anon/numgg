import {
  RARITY_ORDER,
  RMAP,
} from '../../config/rarity.js';
import { extractRegion } from '../../domain/plates/countries.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { hypoPrice } from '../../domain/pricing.js';
import { bulkCost } from '../drop/spin.js';
import { renderExchange } from '../exchange/view.js';
import {
  bulkQuote,
  sellHigh,
  sellLow,
  sellMid,
} from './sell.js';
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
  return hypoPrice(n.rarity, n.flag, extractRegion(n.plate, n.flag));
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
    default: filtered.sort((a,b) => { if(!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1; return b.id - a.id; });
  }
  return filtered;
}

export function updateGarageSummary(){
  const el = document.getElementById('garageSummary'); if(!el) return;
  if(!S.col.length){ el.innerHTML = ''; return; }
  const totalHypo = S.col.reduce((s,n) => s + hypoPrice(n.rarity, n.flag, extractRegion(n.plate, n.flag)), 0);
  el.innerHTML = '💼 Оценка: <b>' + totalHypo.toLocaleString('ru-RU') + ' ₽</b> · уникальных: <b>' + new Set(S.col.map(n=>n.plate+'|'+n.flag)).size + '</b> · на бирже: <b>' + market.listings.length + '</b>';
}

export function renderCollection(){
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
  const coefLow = Math.max(1, Math.min(90, S.coefLow)) / 100;
  const coefHigh = Math.max(1, Math.min(200, S.coefHigh)) / 100;
  grid.innerHTML = slice.map(n => {
    const R = RMAP[n.rarity];
    const hypo = hypoPrice(n.rarity, n.flag, extractRegion(n.plate, n.flag));
    const lowP = Math.max(1, Math.round(hypo * (1 - coefLow)));
    const midP = Math.max(1, Math.round(hypo));
    const highP = Math.max(1, Math.round(hypo * (1 + coefHigh)));
    const listed = !!n.listed;
    const favClass = n.favorite ? ' favorite' : '';
    const star = n.favorite ? '⭐' : '☆';
    return '<div class="ncard '+n.rarity+favClass+'">'+
      '<div class="copy-plate" data-plate="'+n.plate+'" title="Клик — копировать">'+renderRealPlate(n.plate, n.flag, '')+'</div>'+
      '<div class="row"><span class="country">'+n.country+'</span><div class="row-right">'+
      (listed ? '<span class="rar" style="background:var(--orange)">НА БИРЖЕ</span>' : '')+
      '<span class="rar '+n.rarity+'">'+R.name+'</span>'+
      '<button class="fav-btn'+(n.favorite?' active':'')+'" data-fav="'+n.id+'">'+star+'</button></div></div>'+
      '<div class="row"><span class="country">#'+n.id+' · гипот. '+hypo.toLocaleString('ru-RU')+' ₽</span></div>'+
      (listed
        ? '<button class="sell-btn" style="background:var(--red);color:#fff;border-color:var(--red);border-radius:100px;padding:9px;cursor:pointer;font-weight:700" data-unlist="'+n.id+'">Снять с биржи</button>'
        : '<div class="sell-trio">'+
          '<button class="sell-low" data-low="'+n.id+'"><span class="arr">↓</span><span class="pr">'+lowP.toLocaleString('ru-RU')+'</span></button>'+
          '<button class="sell-mid" data-mid="'+n.id+'"><span class="arr">=</span><span class="pr">'+midP.toLocaleString('ru-RU')+'</span></button>'+
          '<button class="sell-high" data-high="'+n.id+'"><span class="arr">↑</span><span class="pr">'+highP.toLocaleString('ru-RU')+'</span></button>'+
          '</div>'
      )+
      '</div>';
  }).join('') + (items.length > MAX ? '<div class="empty">Показаны первые '+MAX+' из '+items.length+'. Сузь фильтр, чтобы увидеть остальные.</div>' : '');
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
    const p = e.currentTarget.dataset.plate;
    if(copyText(p)){ notify('📋 '+p); Sound.click(); }
  }));
}
