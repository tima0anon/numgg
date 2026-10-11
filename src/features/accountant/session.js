import { extractRegion } from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import { shuffle } from '../../domain/random.js';
import {
  doBuyOffer,
  doFulfillOrder,
  findMatchingNumbers,
} from '../exchange/session.js';
import { flags } from '../../state/flags.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

// ACCOUNTANT
export function addAcctLog(text, kind){
  S.acct.log.unshift({ text, kind: kind||'n', t: Date.now() });
  if(S.acct.log.length > 60) S.acct.log.length = 60;
  renderAcctLog();
}

export function renderAcctLog(){
  const box = document.getElementById('acctLog');
  if(!box) return;
  if(!S.acct.log.length){ box.innerHTML = '<div class="empty">Бухгалтер пока молчит.</div>'; return; }
  const now = Date.now();
  box.innerHTML = S.acct.log.slice(0, 40).map(it => {
    const sec = Math.floor((now - it.t)/1000);
    const time = sec<60 ? sec+'с' : Math.floor(sec/60)+'м';
    return '<div class="item '+(it.kind||'n')+'"><span>'+it.text+'</span><span class="t">'+time+'</span></div>';
  }).join('');
}

export function acctSpeedMaxAnalyze(){ return 2 + S.acct.speed * 6; }

export function acctAccuracyChance(){ return 0.35 + S.acct.accuracy * 0.075; }

export function acctThreshold(){ return S.acct.threshold / 100; }

export function runAccountantSession(){
  if(S.acct.mode === 'off') return;
  flags.acctActions = 0;
  const maxActions = S.acct.mode === 'auto' ? 3 : 8;
  const budget = acctSpeedMaxAnalyze();
  const acc = acctAccuracyChance();

  const offerIdx = [];
  for(let i=0;i<market.offers.length;i++) offerIdx.push(i);
  shuffle(offerIdx);
  let checked = 0;
  for(const idx of offerIdx){
    if(checked >= budget) break;
    checked++;
    const o = market.offers[idx];
    if(!o || o.accountantFound) continue;
    S.acct.analyzed++;
    const dev = (o.hypo - o.price) / o.hypo;
    const isMistake = Math.random() > acc;
    const perceivedDev = isMistake ? (Math.random()*0.6 - 0.3) : dev;
    if(perceivedDev >= acctThreshold() && perceivedDev > 0.03){
      o.accountantFound = true;
      S.acct.found++;
      addAcctLog('💡 Находка: ' + o.plate + ' · −' + Math.round(perceivedDev*100) + '%', 'ok');
      if(S.acct.mode === 'auto' && S.acct.autoBuy && flags.acctActions < maxActions){
        if(S.rub >= o.price){ doBuyOffer(o, true); flags.acctActions++; }
      }
    }
  }

  const ordIdx = [];
  for(let i=0;i<market.orders.length;i++) ordIdx.push(i);
  shuffle(ordIdx);
  let checkedO = 0;
  const budgetO = Math.max(1, Math.floor(budget/2));
  for(const idx of ordIdx){
    if(checkedO >= budgetO) break;
    checkedO++;
    const o = market.orders[idx];
    if(!o || o.accountantFound) continue;
    S.acct.analyzed++;
    const matches = findMatchingNumbers(o.mask);
    if(matches.length === 0) continue;
    matches.sort((a,b) => hypoPrice(a.rarity, a.flag, extractRegion(a.plate, a.flag)) - hypoPrice(b.rarity, b.flag, extractRegion(b.plate, b.flag)));
    const best = matches[0];
    const bestHypo = hypoPrice(best.rarity, best.flag, extractRegion(best.plate, best.flag));
    const profitRatio = (o.reward - bestHypo) / bestHypo;
    const isMistake = Math.random() > acc;
    const perceived = isMistake ? (Math.random()*0.4 - 0.15) : profitRatio;
    if(perceived >= acctThreshold()/1.5){
      o.accountantFound = true;
      o.accountantBestId = best.id;
      S.acct.found++;
      addAcctLog('🎯 Заказ: ' + o.mask + ' · награда ' + o.reward.toLocaleString('ru-RU') + ' ₽', 'ok');
      if(S.acct.mode === 'auto' && S.acct.autoSell && flags.acctActions < maxActions){
        if(o.reward > bestHypo){ doFulfillOrder(o.id, best.id, true); flags.acctActions++; }
      }
    }
  }
}
