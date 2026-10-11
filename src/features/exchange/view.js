import {
  RARITY_ORDER,
  RMAP,
} from '../../config/rarity.js';
import { extractRegion } from '../../domain/plates/countries.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { hypoPrice } from '../../domain/pricing.js';
import {
  doBuyOffer,
  doFulfillOrder,
  findMatchingNumbers,
} from './session.js';
import { addAcctLog } from '../accountant/session.js';
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
  const sort = market.filters.oSort;
  if(sort === 'dev-asc') list.sort((a,b) => ((a.price-a.hypo)/a.hypo) - ((b.price-b.hypo)/b.hypo));
  else if(sort === 'dev-desc') list.sort((a,b) => ((b.price-b.hypo)/b.hypo) - ((a.price-a.hypo)/a.hypo));
  else if(sort === 'price-asc') list.sort((a,b) => a.price - b.price);
  else if(sort === 'price-desc') list.sort((a,b) => b.price - a.price);
  else if(sort === 'rarity-desc') list.sort((a,b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  else if(sort === 'rarity-asc') list.sort((a,b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  if(S.acct.mode !== 'off') list.sort((a,b) => (b.accountantFound?1:0) - (a.accountantFound?1:0));
  return list;
}

function sortedOrders(){
  let list = market.orders.slice();
  if(market.filters.ordCountry !== 'all') list = list.filter(o => o.flag === market.filters.ordCountry);
  const sort = market.filters.ordSort;
  if(sort === 'reward-desc') list.sort((a,b) => b.reward - a.reward);
  else if(sort === 'reward-asc') list.sort((a,b) => a.reward - b.reward);
  else if(sort === 'spec-desc') list.sort((a,b) => b.specificity - a.specificity);
  else if(sort === 'matches-desc') list.sort((a,b) => findMatchingNumbers(b.mask).length - findMatchingNumbers(a.mask).length);
  if(S.acct.mode !== 'off') list.sort((a,b) => (b.accountantFound?1:0) - (a.accountantFound?1:0));
  return list;
}

function refreshAfterBatch(){
  updateBalances(); renderCollection(); renderExchange(); updateStats(); updateAchievements(); save();
}

export function buyUnderpriced(){
  const picks = [];
  let rub = S.rub;
  const deals = sortedOffers()
    .filter(o => o.price < o.hypo * 0.98)
    .sort((a, b) => ((a.price - a.hypo) / a.hypo) - ((b.price - b.hypo) / b.hypo));
  for(const o of deals){
    if(rub < o.price) continue;
    rub -= o.price;
    picks.push(o);
  }
  if(!picks.length){ notify('Нет лотов ниже рынка, которые можно купить'); Sound.error(); return; }
  const sum = picks.reduce((s, o) => s + o.price, 0);
  if(!confirm('Скупить ' + picks.length + ' лотов ниже рынка за ' + sum.toLocaleString('ru-RU') + ' ₽?')) return;
  let bought = 0;
  let spent = 0;
  for(const o of picks){
    const price = o.price;
    if(doBuyOffer(o, true, true)){ bought++; spent += price; }
  }
  Sound.buy(); haptic(15);
  notify('Куплено ' + bought + ' лотов за ' + spent.toLocaleString('ru-RU') + ' ₽');
  addAcctLog('🛒 Скупка · ' + bought + ' шт · ' + spent.toLocaleString('ru-RU') + ' ₽', 'ok');
  refreshAfterBatch();
}

export function fulfillProfitable(){
  const jobs = [];
  const used = new Set();
  for(const o of sortedOrders()){
    const matches = findMatchingNumbers(o.mask).filter(n => !n.favorite && !used.has(n.id));
    if(!matches.length) continue;
    matches.sort((a,b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate, a.flag)) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate, b.flag)));
    const best = matches[0];
    const hypo = hypoPrice(best.rarity, best.flag, extractRegion(best.plate, best.flag));
    if(o.reward < hypo) continue;
    used.add(best.id);
    jobs.push({ order: o, num: best });
  }
  if(!jobs.length){ notify('Нет выгодных заказов без избранного'); Sound.error(); return; }
  const sum = jobs.reduce((s, j) => s + j.order.reward, 0);
  if(!confirm('Закрыть ' + jobs.length + ' заказов и получить ' + sum.toLocaleString('ru-RU') + ' ₽?\nИзбранное не отдаётся. Берётся самый дешёвый подходящий номер.')) return;
  let done = 0;
  let gained = 0;
  for(const job of jobs){
    if(doFulfillOrder(job.order.id, job.num.id, true, true)){ done++; gained += job.order.reward; }
  }
  Sound.coin_big(); haptic([20,20,40]);
  notify('🎯 Закрыто заказов: ' + done + ' · +' + gained.toLocaleString('ru-RU') + ' ₽');
  addAcctLog('🎯 Закрыто заказов: ' + done + ' · +' + gained.toLocaleString('ru-RU') + ' ₽', 'ok');
  refreshAfterBatch();
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
  if(!list.length){ grid.innerHTML = '<div class="empty">Нет предложений. Подожди следующую сессию.</div>'; return; }
  grid.innerHTML = list.map(o => {
    const R = RMAP[o.rarity];
    const dev = (o.price - o.hypo) / o.hypo;
    const devPct = Math.round(dev*100);
    const devCls = dev < -0.02 ? 'neg' : dev > 0.02 ? 'pos' : 'zero';
    const canBuy = S.rub >= o.price;
    const cls = (o.accountantFound?' accountant-found':'');
    return '<div class="excard '+o.rarity+cls+'">'+renderRealPlate(o.plate, o.flag, '')+
      '<div class="row"><span class="country">'+o.country+(o.region?' · '+o.region:'')+'</span><span class="rar '+o.rarity+'">'+R.name+'</span></div>'+
      '<div class="pricerow"><span class="plabel">Гипот. цена</span><span class="pval hypo">'+o.hypo.toLocaleString('ru-RU')+' ₽</span></div>'+
      '<div class="pricerow"><span class="plabel">Цена лота</span><span class="pval '+(dev<0?'good':dev>0?'bad':'ask')+'">'+o.price.toLocaleString('ru-RU')+' ₽</span><span class="dev '+devCls+'">'+(devPct>=0?'+':'')+devPct+'%</span></div>'+
      '<button class="buy-btn" data-id="'+o.id+'"'+(canBuy?'':' disabled')+'>'+(canBuy?'Купить за '+o.price.toLocaleString('ru-RU')+' ₽':'Не хватает '+(o.price-S.rub).toLocaleString('ru-RU')+' ₽')+'</button>'+
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
  if(!list.length){ grid.innerHTML = '<div class="empty">Нет активных заказов. Сложные живут до 3 минут.</div>'; return; }
  grid.innerHTML = list.map(o => {
    const R = RMAP[o.rarity];
    const matches = findMatchingNumbers(o.mask).slice().sort((a,b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate, a.flag)) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate, b.flag)));
    const matchCount = matches.length;
    const specPct = Math.round(o.specificity*100);
    const canFulfill = matchCount > 0;
    const lifetimeLeft = Math.max(0, o.until - Date.now());
    const isLong = (o.until - o.createdAt) > 60000;
    const cls = (o.accountantFound?' accountant-found':'');
    const maskHTML = o.mask.split('').map(ch => ch==='*' ? '<span class="star">✳</span>' : (ch===' '?'&nbsp;':ch)).join('');
    return '<div class="excard '+o.rarity+cls+'">'+
      '<div class="ordermask">'+maskHTML+'</div>'+
      '<div class="row"><span class="country">'+o.country+(isLong?' · ⏳ долгий':'')+'</span><span class="rar '+o.rarity+'">'+R.name+'</span></div>'+
      '<div class="pricerow"><span class="plabel">Точность</span><span class="pval '+(specPct>=60?'good':specPct<=30?'bad':'ask')+'">'+specPct+'%</span></div>'+
      '<div class="pricerow"><span class="plabel">Награда</span><span class="pval good">'+o.reward.toLocaleString('ru-RU')+' ₽</span></div>'+
      '<div class="mylisting-info"><span>Совпадений: '+matchCount+'</span><span>⏱ '+Math.round(lifetimeLeft/1000)+'с</span></div>'+
      (matchCount > 1 ? '<select class="order-pick">'+matches.map(m => '<option value="'+m.id+'"'+(o.accountantBestId===m.id?' selected':'')+'>'+m.plate+(m.favorite?' ⭐':'')+' · '+hypoPrice(m.rarity, m.flag, extractRegion(m.plate, m.flag)).toLocaleString('ru-RU')+' ₽</option>').join('')+'</select>' : '')+
      '<button class="fulfill-btn" data-id="'+o.id+'"'+(canFulfill?'':' disabled')+'>'+(canFulfill?'Выполнить ('+matchCount+')':'Нет номера')+'</button>'+
      '</div>';
  }).join('');
  grid.querySelectorAll('.fulfill-btn').forEach(b => b.addEventListener('click', e => {
    const o = market.orders.find(x => x.id === e.currentTarget.dataset.id);
    if(!o) return;
    const matches = findMatchingNumbers(o.mask);
    if(!matches.length) return;
    matches.sort((a,b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate,a.flag)) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate,b.flag)));
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
  if(!market.listings.length){ grid.innerHTML = '<div class="empty">У тебя нет активных лотов. Выставляй номера из гаража тремя кнопками.</div>'; return; }
  grid.innerHTML = market.listings.map(l => {
    const num = S.col.find(n => n.id === l.numId);
    if(!num) return '';
    const R = RMAP[num.rarity];
    const hypo = hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag));
    const dev = (l.price - hypo) / hypo;
    const devPct = Math.round(dev*100);
    return '<div class="excard '+num.rarity+'">'+renderRealPlate(num.plate, num.flag, '')+
      '<div class="row"><span class="country">'+num.country+'</span><span class="rar '+num.rarity+'">'+R.name+'</span></div>'+
      '<div class="pricerow"><span class="plabel">Гипот. цена</span><span class="pval hypo">'+hypo.toLocaleString('ru-RU')+' ₽</span></div>'+
      '<div class="pricerow"><span class="plabel">Мой лот</span><span class="pval '+(dev<0?'good':dev>0?'bad':'ask')+'">'+l.price.toLocaleString('ru-RU')+' ₽</span><span class="dev '+(dev<0?'neg':dev>0?'pos':'zero')+'">'+(devPct>=0?'+':'')+devPct+'%</span></div>'+
      '<div class="mylisting-info"><span>Сессий: '+l.sessions+'</span></div>'+
      '<div class="progressbar"><div style="width:'+Math.min(100, l.sessions*8)+'%"></div></div>'+
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
