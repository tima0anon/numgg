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
  const place = document.getElementById('rankPlace');
  const sub = document.getElementById('rankSub');
  if(place) place.textContent = tier.emoji + ' ' + Math.floor(S.rub).toLocaleString('ru-RU') + ' ₽';
  if(sub) sub.textContent = tier.label + ' · баланс в этом браузере';
  list.innerHTML = '<div class="empty">Загружаю топ…</div>';
  try {
    const data = await fetchTop();
    const me = data.me;
    if(me && me.place){
      sub.textContent = tier.label + ' · ' + me.place + ' место в общем топе';
    }
    if(!data.top.length){
      list.innerHTML = '<div class="empty">Общая таблица пока пустая.</div>';
      return;
    }
    const myNick = me && me.nick;
    list.innerHTML = data.top.map(row => {
      const mine = myNick && row.nick === myNick;
      return '<div class="rank-row'+(mine ? ' me' : '')+(row.place <= 3 ? ' top' : '')+'">'+
        '<span class="pos">'+row.place+'</span>'+
        '<span class="who">'+(mine ? 'Ты · ' : '')+esc(row.nick)+'</span>'+
        '<span class="money">'+Math.floor(row.balance).toLocaleString('ru-RU')+' ₽</span>'+
        '</div>';
    }).join('');
  } catch(error){
    list.innerHTML = '<div class="empty">'+esc(error.message || 'Не удалось загрузить рейтинг')+'</div>';
  }
}
