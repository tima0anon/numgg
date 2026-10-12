import { WEALTH_TIERS, wealthTierIdx } from '../../config/wealth.js';
import { fetchTop } from '../../services/remote.js';
import { S } from '../../state/player.js';

export function rememberPeak(){
  if(typeof S.peakRub !== 'number' || S.rub > S.peakRub) S.peakRub = S.rub;
}

function esc(value){
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

export async function renderRank(){
  rememberPeak();
  const list = document.getElementById('rankList');
  if(!list) return;
  const tier = WEALTH_TIERS[wealthTierIdx(S.rub)];
  const peak = Math.max(Math.floor(S.rub), Math.floor(S.peakRub || 0));
  const place = document.getElementById('rankPlace');
  const sub = document.getElementById('rankSub');
  if(place) place.textContent = tier.emoji + ' ' + peak.toLocaleString('ru-RU') + ' ₽';
  if(sub) sub.textContent = tier.label + ' · твой максимальный баланс';
  list.innerHTML = '<div class="empty">Загружаю топ…</div>';
  try {
    const data = await fetchTop();
    const me = data.me;
    if(me && me.place){
      sub.textContent = tier.label + ' · ' + me.place + ' место в топе по максимальному балансу';
    }
    if(!data.top.length){
      list.innerHTML = '<div class="empty">Общая таблица пока пустая.</div>';
      return;
    }
    const myNick = me && me.nick;
    list.innerHTML = data.top.map(row => {
      const mine = myNick && row.nick === myNick;
      const medal = row.place === 1 ? ' gold' : row.place === 2 ? ' silver' : row.place === 3 ? ' bronze' : '';
      return '<div class="rank-row'+(mine ? ' me' : '')+(row.place <= 3 ? ' top' : '')+medal+'">'+
        '<span class="pos">'+row.place+'</span>'+
        '<span class="who">'+(mine ? 'Ты · ' : '')+esc(row.nick)+'</span>'+
        '<span class="money">'+Math.floor(row.balance).toLocaleString('ru-RU')+' ₽</span>'+
        '</div>';
    }).join('');
  } catch(error){
    list.innerHTML = '<div class="empty">'+esc(error.message || 'Не удалось загрузить рейтинг')+'</div>';
  }
}
