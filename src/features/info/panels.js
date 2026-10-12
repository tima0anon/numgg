import {
  ACCT_AUTO_COST,
  ACCT_HIRE_COST,
  SPIN_COST_BY_COUNTRY,
} from '../../config/constants.js';
import { RARITY } from '../../config/rarity.js';
import {
  WEALTH_TIERS,
  wealthTierIdx,
} from '../../config/wealth.js';
import { REGION_GUIDE } from '../../domain/plates/market.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { S } from '../../state/player.js';

const SPIN_LABEL = {
  all: 'Все страны',
  ru: 'Россия',
  by: 'Беларусь',
  ua: 'Украина',
  us: 'США',
  cn: 'Китай'
};

function chanceText(weight, total){
  const pct = weight / total * 100;
  const digits = pct >= 1 ? 1 : pct >= 0.1 ? 2 : 3;
  return pct.toFixed(digits).replace('.', ',') + '%';
}

export function renderEconomyInfo(){
  const total = RARITY.reduce((sum, row) => sum + row.w, 0);
  const rarityBody = document.getElementById('rarityInfoBody');
  if(rarityBody){
    rarityBody.innerHTML = RARITY.map(row =>
      '<tr><td class="rar-name '+row.id+'">'+row.name+'</td><td>'+chanceText(row.w, total)+'</td><td class="rar-price">'+row.price.toLocaleString('ru-RU')+' ₽</td></tr>'
    ).join('');
  }
  const spinBody = document.getElementById('spinCostBody');
  if(spinBody){
    const order = ['all','by','ua','us','ru','cn'];
    spinBody.innerHTML = order.map(id =>
      '<tr><td class="rar-name">'+SPIN_LABEL[id]+'</td><td class="rar-price">'+SPIN_COST_BY_COUNTRY[id].toLocaleString('ru-RU')+' ₽</td></tr>'
    ).join('');
  }
  const regionBody = document.getElementById('regionMultBody');
  if(regionBody){
    regionBody.innerHTML = REGION_GUIDE.map(([name, mult]) =>
      '<tr><td class="rar-name">'+name+'</td><td class="rar-price">×'+String(mult).replace('.', ',')+'</td></tr>'
    ).join('');
  }
  const hire = document.getElementById('infoHire');
  const auto = document.getElementById('infoAuto');
  if(hire) hire.textContent = ACCT_HIRE_COST.toLocaleString('ru-RU') + ' ₽';
  if(auto) auto.textContent = ACCT_AUTO_COST.toLocaleString('ru-RU') + ' ₽';
}

// OTHER RENDER
export function renderFormatsTab(){
  const list = document.getElementById('formatList'); if(!list) return;
  const samples = [
    {flag:'ru', name:'Россия', plate:'А123ВС 77'},
    {flag:'by', name:'Беларусь', plate:'1234 АВ-7'},
    {flag:'cn', name:'Китай', plate:'京A 12345'},
    {flag:'us', name:'США', plate:'ABC 1234'},
    {flag:'ua', name:'Украина', plate:'АА 1234 ВВ'}
  ];
  list.innerHTML = samples.map(s => '<div class="format-row"><div class="fc">'+s.name+'</div><div>'+renderRealPlate(s.plate, s.flag, 'md')+'</div></div>').join('');
}

export function renderWealthTable(){
  const tb = document.querySelector('#wealthTable tbody'); if(!tb) return;
  const cur = wealthTierIdx(S.rub);
  tb.innerHTML = WEALTH_TIERS.map((t,i) => {
    const nextMin = (i < WEALTH_TIERS.length-1) ? WEALTH_TIERS[i+1].min : null;
    const range = nextMin ? (t.min.toLocaleString('ru-RU')+' – '+nextMin.toLocaleString('ru-RU')+' ₽') : (t.min.toLocaleString('ru-RU')+' ₽ и выше');
    return '<tr'+(i===cur?' class="active"':'')+'><td>'+t.emoji+' '+t.label+'</td><td>'+range+'</td></tr>';
  }).join('');
}
