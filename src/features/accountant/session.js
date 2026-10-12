import { extractRegion } from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';
import { updateAcctUI } from './view.js';
import { doBuyOffer, doFulfillOrder, findMatchingNumbers } from '../exchange/session.js';

export function addAcctLog(text, kind){
  S.acct.log.unshift({ text, kind: kind || 'n', t: Date.now() });
  if(S.acct.log.length > 60) S.acct.log.length = 60;
  renderAcctLog();
}

function esc(value){
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

export function renderAcctLog(){
  const box = document.getElementById('acctLog');
  if(!box) return;
  if(!S.acct.log.length){ box.innerHTML = '<div class="empty">Журнал пуст. Включи бухгалтера — запись появится в начале следующей сессии биржи.</div>'; return; }
  const now = Date.now();
  box.innerHTML = S.acct.log.slice(0, 40).map(it => {
    const sec = Math.floor((now - it.t) / 1000);
    const time = sec < 60 ? sec + 'с' : Math.floor(sec / 60) + 'м';
    return '<div class="item '+(it.kind || 'n')+'"><span>'+esc(it.text)+'</span><span class="t">'+time+'</span></div>';
  }).join('');
}

export function acctCoverage(){
  const speed = S.acct.speed || 0;
  return { offers: 8 + speed * 4, orders: 6 + speed * 2 };
}

export function noticeChance(){
  return Math.min(0.98, 0.45 + (S.acct.accuracy || 0) * 0.066);
}

export function falseAlarmChance(){
  return Math.max(0.02, 0.22 - (S.acct.accuracy || 0) * 0.025);
}

export function effectiveThreshold(){
  return Math.max(0.02, (S.acct.threshold || 15) / 100 - (S.acct.risk || 0) * 0.015);
}

export function autoSlots(){
  return S.acct.mode === 'auto' ? 1 + (S.acct.speed || 0) : 0;
}

export function runAccountantSession(){
  if(S.acct.mode === 'off'){
    S.acct.report = null;
    updateAcctUI();
    return;
  }
  const threshold = effectiveThreshold();
  const notice = noticeChance();
  const alarm = falseAlarmChance();
  const cover = acctCoverage();
  const offers = market.offers.filter(o => o && !o.accountantFound)
    .map(o => ({ o, edge: (o.hypo - o.price) / Math.max(1, o.hypo) }))
    .sort((a, b) => b.edge - a.edge);
  const lookedOffers = offers.slice(0, cover.offers);
  const picks = [];
  const suspects = [];
  for(const row of lookedOffers){
    S.acct.analyzed++;
    const good = row.edge >= threshold;
    if(good && Math.random() < notice){
      row.o.accountantFound = true;
      S.acct.found++;
      picks.push({
        kind: 'buy', id: row.o.id, plate: row.o.plate, price: row.o.price, market: row.o.hypo,
        edge: row.edge, suspect: false, done: false,
      });
    } else if(!good && row.edge > -0.02 && Math.random() < alarm){
      suspects.push({
        kind: 'buy', id: row.o.id, plate: row.o.plate, price: row.o.price, market: row.o.hypo,
        edge: row.edge, suspect: true, done: false,
      });
    }
  }

  const orders = market.orders.filter(o => o && !o.accountantFound);
  const lookedOrders = orders.slice(0, cover.orders);
  let skippedFav = 0;
  for(const order of lookedOrders){
    S.acct.analyzed++;
    const all = findMatchingNumbers(order.mask);
    const matches = all.filter(n => !n.favorite);
    if(!matches.length){ if(all.length) skippedFav++; continue; }
    matches.sort((a, b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate, a.flag), a.plate) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate, b.flag), b.plate));
    const best = matches[0];
    const marketPrice = hypoPrice(best.rarity, best.flag, extractRegion(best.plate, best.flag), best.plate);
    const edge = (order.reward - marketPrice) / Math.max(1, marketPrice);
    const good = edge >= threshold;
    if(good && Math.random() < notice){
      order.accountantFound = true;
      S.acct.found++;
      picks.push({
        kind: 'sell', id: order.id, numId: best.id, plate: best.plate, mask: order.mask,
        price: order.reward, market: marketPrice, edge, suspect: false, done: false,
      });
    } else if(!good && edge > -0.05 && Math.random() < alarm){
      suspects.push({
        kind: 'sell', id: order.id, numId: best.id, plate: best.plate, mask: order.mask,
        price: order.reward, market: marketPrice, edge, suspect: true, done: false,
      });
    }
  }

  picks.sort((a, b) => b.edge - a.edge);
  const slots = autoSlots();
  let bought = 0;
  let sold = 0;
  let broke = false;
  picks.forEach((item, index) => {
    if(index >= slots) return;
    if(item.kind === 'buy'){
      const offer = market.offers.find(o => o.id === item.id);
      if(!offer) return;
      if(S.rub < offer.price){ broke = true; return; }
      if(doBuyOffer(offer, true)){ item.done = true; bought++; }
    } else if(doFulfillOrder(item.id, item.numId, true)){
      item.done = true;
      sold++;
    }
  });

  const pct = n => Math.round(n * 100);
  const parts = ['Посмотрел ' + lookedOffers.length + ' из ' + market.offers.length + ' лотов и ' + lookedOrders.length + ' из ' + market.orders.length + ' заказов.'];
  if(picks.length) parts.push('Выгодных: ' + picks.length + '.');
  else parts.push('Выгодных по порогу ' + pct(threshold) + '% не увидел.');
  if(bought || sold) parts.push('Сам закрыл: покупок ' + bought + ', продаж ' + sold + '.');
  else if(slots && picks.length) parts.push('Сделки оставил кнопками.');
  if(broke) parts.push('На часть лотов не хватило денег.');
  if(skippedFav) parts.push('Избранное не продавал.');
  addAcctLog(parts.join(' '), picks.length ? 'ok' : 'n');
  if(suspects.length) addAcctLog('Сомнительных оценок: ' + suspects.length + '. Деньги на них не тратил.', 'n');

  S.acct.report = {
    offersSeen: lookedOffers.length,
    offersTotal: market.offers.length,
    ordersSeen: lookedOrders.length,
    ordersTotal: market.orders.length,
    found: picks.length,
    bought, sold,
    advice: picks.concat(suspects).slice(0, 8),
  };
  updateAcctUI();
}

export function takeAdvice(kind, id, numId){
  const advice = S.acct.report && S.acct.report.advice || [];
  const num = numId == null || numId === '' ? null : Number(numId);
  const item = advice.find(row => row.kind === kind && row.id === id && (kind !== 'sell' || Number(row.numId) === num));
  if(!item || item.done || item.suspect) return;
  let ok = false;
  if(kind === 'buy'){
    const offer = market.offers.find(o => o.id === id);
    if(!offer){ notify('Этот лот уже забрали'); return; }
    if(S.rub < offer.price){ notify('Не хватает денег'); return; }
    ok = !!doBuyOffer(offer, true);
  } else {
    ok = !!doFulfillOrder(id, num, true);
    if(!ok) notify('Заказ или номер уже недоступен');
  }
  if(!ok) return;
  item.done = true;
  if(kind === 'buy') S.acct.report.bought = (S.acct.report.bought || 0) + 1;
  else S.acct.report.sold = (S.acct.report.sold || 0) + 1;
  save();
  updateAcctUI();
}
