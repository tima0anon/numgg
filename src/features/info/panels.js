import {
  WEALTH_TIERS,
  wealthTierIdx,
} from '../../config/wealth.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { S } from '../../state/player.js';

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
