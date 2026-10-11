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
  specificity,
} from './session.js';
import { renderCollection } from '../garage/view.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

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
  let list = market.orders.slice();
  if(market.filters.ordCountry !== 'all') list = list.filter(o => o.flag === market.filters.ordCountry);
  const sort = market.filters.ordSort;
  if(sort === 'reward-desc') list.sort((a,b) => b.reward - a.reward);
  else if(sort === 'reward-asc') list.sort((a,b) => a.reward - b.reward);
  else if(sort === 'spec-desc') list.sort((a,b) => b.specificity - a.specificity);
  else if(sort === 'matches-desc') list.sort((a,b) => findMatchingNumbers(b.mask).length - findMatchingNumbers(a.mask).length);
  if(S.acct.mode !== 'off') list.sort((a,b) => (b.accountantFound?1:0) - (a.accountantFound?1:0));
  if(!list.length){ grid.innerHTML = '<div class="empty">Нет активных заказов. Сложные живут до 3 минут.</div>'; return; }
  grid.innerHTML = list.map(o => {
    const R = RMAP[o.rarity];
    const matches = findMatchingNumbers(o.mask);
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
    if(o.accountantBestId){ const found = matches.find(m => m.id === o.accountantBestId); if(found) target = found; }
    if(matches.length > 1){
      const pick = prompt('Выбери номер:\n' + matches.map((m,i) => (i+1)+') '+m.plate+' · '+RMAP[m.rarity].name+' · гипот. '+hypoPrice(m.rarity,m.flag,extractRegion(m.plate,m.flag))+' ₽').join('\n') + '\n\nВведи номер (1-'+matches.length+').', '1');
      if(pick){ const idx = parseInt(pick,10)-1; if(idx>=0 && idx<matches.length) target = matches[idx]; else return; }
      else return;
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
