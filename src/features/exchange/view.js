import { RMAP } from '../../config/rarity.js';
import { extractRegion } from '../../domain/plates/countries.js';
import { describePlate } from '../../domain/plates/market.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { marketMood, saleChance, saleHint } from '../../domain/demand.js';
import { hypoPrice } from '../../domain/pricing.js';
import {
  doBuyOffer,
  doFulfillOrder,
  findMatchingNumbers,
} from './session.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';
import {
  updateAchievements,
  updateStats,
} from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

function sortedOffers(){
  let list = market.offers.slice();
  if(market.filters.oCountry !== 'all') list = list.filter(o => o.flag === market.filters.oCountry);
  if(market.filters.oRarity !== 'all') list = list.filter(o => o.rarity === market.filters.oRarity);
  if(market.filters.oSearch){ const q = market.filters.oSearch.toLowerCase(); list = list.filter(o => o.plate.toLowerCase().includes(q)); }
  return list;
}

function sortedOrders(){
  let list = market.orders.slice();
  if(market.filters.ordCountry !== 'all') list = list.filter(o => o.flag === market.filters.ordCountry);
  return list;
}

function rub(n){ return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

function marketLine(price, hypo){
  const gap = Math.round(hypo - price);
  const edge = Math.abs(gap).toLocaleString('ru-RU');
  if(gap >= 1) return '<div class="deal good">+'+edge+' ₽ к рынку</div>';
  if(gap <= -1) return '<div class="deal bad">−'+edge+' ₽ к рынку</div>';
  return '<div class="deal">Цена как на рынке</div>';
}

function refreshAfterBatch(){
  updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements(); save();
}

export function unlistAll(){
  if(!market.listings.length){ notify('На бирже нет твоих лотов'); Sound.error(); return; }
  if(!confirm('Снять ' + market.listings.length + ' лотов с продажи?')) return;
  for(const l of market.listings){
    const num = S.col.find(n => n.id === l.numId);
    if(num) num.listed = false;
  }
  market.listings = [];
  Sound.click();
  notify('Все лоты сняты с продажи');
  refreshAfterBatch();
}

export function renderExchange(){
  document.getElementById('cntOffers').textContent = market.offers.length;
  document.getElementById('cntOrders').textContent = market.orders.length;
  document.getElementById('cntMy').textContent = market.listings.length;
  renderOffers();
  renderOrders();
  renderMyListings();
  updateNavBadge();
}

export function renderOffers(){
  const grid = document.getElementById('exOfferGrid');
  if(!grid) return;
  const list = sortedOffers();
  if(!list.length){ grid.innerHTML = '<div class="empty">Сейчас продавать нечего. Новые номера появятся со следующим обновлением.</div>'; return; }
  grid.innerHTML = list.map(o => {
    const R = RMAP[o.rarity];
    const cooling = Date.now() < (market.nextBuyAt || 0);
    const canBuy = S.rub >= o.price && !cooling;
    const cls = (o.accountantFound?' accountant-found':'');
    return '<div class="excard '+o.rarity+cls+'">'+
      '<div class="plate-stage">'+renderRealPlate(o.plate, o.flag, '')+'</div>'+
      '<div class="card-meta"><span class="who">'+o.country+'</span><span class="rar '+o.rarity+'">'+R.name+'</span></div>'+
      '<div class="bought-line">'+describePlate(o.plate, o.flag, o.region, o.rarity)+'</div>'+
      '<div class="card-price">'+rub(o.price)+'<span>цена покупки</span></div>'+
      marketLine(o.price, o.hypo)+
      '<button class="buy-btn" data-id="'+o.id+'"'+(canBuy?'':' disabled')+'>'+(cooling?'Подожди':canBuy?'Купить':'Не хватает '+rub(o.price-S.rub))+'</button>'+
      '</div>';
  }).join('');
  grid.querySelectorAll('.buy-btn').forEach(b => b.addEventListener('click', e => {
    const o = market.offers.find(x => x.id === e.currentTarget.dataset.id);
    if(o) doBuyOffer(o, false);
  }));
}

export function renderOrders(){
  const grid = document.getElementById('exOrderGrid');
  if(!grid) return;
  const list = sortedOrders();
  if(!list.length){ grid.innerHTML = '<div class="empty">Заказов нет. Новые появятся со следующим обновлением.</div>'; return; }
  grid.innerHTML = list.map(o => {
    const R = RMAP[o.rarity];
    const matches = findMatchingNumbers(o.mask).slice().sort((a,b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate, a.flag), a.plate) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate, b.flag), b.plate));
    const shown = matches.slice(0, 3);
    const matchCount = matches.length;
    const canFulfill = matchCount > 0;
    const cls = (o.accountantFound?' accountant-found':'');
    const fit = matchCount === 0 ? 'В гараже нет такого номера' : matchCount === 1 ? 'Подойдёт 1 номер из гаража' : 'Подойдёт '+matchCount+' из гаража';
    const pick = shown.length > 1
      ? '<select class="order-pick" aria-label="Какой номер отдать">'+shown.map(m => '<option value="'+m.id+'"'+(o.accountantBestId===m.id?' selected':'')+'>'+m.plate+(m.favorite?' ★':'')+'</option>').join('')+'</select>'
      : '';
    return '<div class="excard '+o.rarity+cls+'">'+
      '<div class="plate-stage" title="Звёздочка — любой символ">'+renderRealPlate(o.mask, o.flag, '')+'</div>'+
      '<div class="card-meta"><span class="who">'+o.country+'</span><span class="rar '+o.rarity+'">'+R.name+'</span></div>'+
      '<div class="card-price">'+rub(o.reward)+'<span>заплатят тебе</span></div>'+
      '<div class="deal good">×'+(o.multiplier || (o.reward / Math.max(1, o.hypo))).toFixed(2)+' к рынку заказа · '+rub(o.reward - o.hypo)+'</div>'+
      '<div class="deal">'+(canFulfill ? fit : 'В гараже нет такого номера')+'</div>'+
      pick+
      '<button class="fulfill-btn" data-id="'+o.id+'"'+(canFulfill?'':' disabled')+'>'+(canFulfill?'Продать этот номер':'Нет подходящего')+'</button>'+
      '</div>';
  }).join('');
  grid.querySelectorAll('.fulfill-btn').forEach(b => b.addEventListener('click', e => {
    const o = market.orders.find(x => x.id === e.currentTarget.dataset.id);
    if(!o) return;
    const matches = findMatchingNumbers(o.mask);
    if(!matches.length) return;
    matches.sort((a,b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate,a.flag), a.plate) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate,b.flag), b.plate));
    let target = matches[0];
    const sel = e.currentTarget.parentElement.querySelector('.order-pick');
    if(sel){
      const picked = matches.find(m => m.id === parseInt(sel.value, 10));
      if(picked) target = picked;
    } else if(o.accountantBestId){
      const found = matches.find(m => m.id === o.accountantBestId);
      if(found) target = found;
    }
    doFulfillOrder(o.id, target.id, false);
  }));
}

export function renderMyListings(){
  const grid = document.getElementById('exMyGrid');
  if(!grid) return;
  if(!market.listings.length){ grid.innerHTML = '<div class="empty">Своих лотов нет. Выстави номер из гаража.</div>'; return; }
  grid.innerHTML = market.listings.map(l => {
    const num = S.col.find(n => Number(n.id) === Number(l.numId));
    if(!num) return '';
    const R = RMAP[num.rarity];
    const region = extractRegion(num.plate, num.flag);
    const hypo = hypoPrice(num.rarity, num.flag, region, num.plate);
    const mood = marketMood(num.flag, region, num.rarity);
    const chance = saleChance(l.price, hypo, mood, num.rarity);
    return '<div class="excard '+num.rarity+'">'+
      '<div class="plate-stage">'+renderRealPlate(num.plate, num.flag, '')+'</div>'+
      '<div class="card-meta"><span class="who">'+num.country+'</span><span class="rar '+num.rarity+'">'+R.name+'</span></div>'+
      '<div class="card-price">'+rub(l.price)+'<span>твоя цена</span></div>'+
      '<div class="bought-line">'+describePlate(num.plate, num.flag, region, num.rarity)+'</div>'+
      '<div class="deal '+mood.cls+'"><span class="roulette">⟳</span> шанс '+Math.round(chance*100)+'% за эту минуту</div>'+
      '<div class="deal">'+saleHint(chance, l.price, hypo, mood)+'</div>'+
      '<button class="buy-btn" style="background:var(--red)" data-id="'+l.numId+'">Снять с продажи</button>'+
      '</div>';
  }).join('');
  grid.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', e => {
    const id = parseInt(e.currentTarget.dataset.id,10);
    const idx = market.listings.findIndex(l => l.numId === id);
    if(idx >= 0){
      const num = S.col.find(n => n.id === id);
      if(num) num.listed = false;
      market.listings.splice(idx,1);
      notify('Лот снят с продажи'); Sound.click();
      renderExchange(); renderCollection(); save();
    }
  }));
}

export function updateNavBadge(){
  const badge = document.getElementById('navExBadge');
  if(!badge) return;
  const found = market.offers.filter(o => o.accountantFound).length + market.orders.filter(o => o.accountantFound).length;
  if(found > 0 && S.acct.mode !== 'off'){ badge.textContent = found; badge.style.display = 'inline-block'; }
  else badge.style.display = 'none';
}
