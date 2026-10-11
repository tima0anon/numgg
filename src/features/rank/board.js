import { WEALTH_TIERS, wealthTierIdx } from '../../config/wealth.js';
import { fetchTop, readSession } from '../../services/remote.js';
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
  const session = readSession();
  const account = document.getElementById('rankAccount');
  if(account) account.textContent = (session ? session.nick : 'Гость') + ' · в таблице баланс этого браузера';
  list.innerHTML = '<div class="empty">Загружаю топ…</div>';
  try {
    const data = await fetchTop();
    const me = data.me;
    const tier = WEALTH_TIERS[wealthTierIdx(S.rub)];
    const place = document.getElementById('rankPlace');
    const sub = document.getElementById('rankSub');
    if(me && me.place){
      place.textContent = me.place + ' место';
      sub.textContent = tier.emoji + ' ' + tier.label + ' · ' + Math.floor(me.balance).toLocaleString('ru-RU') + ' ₽' + (me.place > 100 ? ' · вне первой сотни' : '');
    } else {
      place.textContent = 'без места';
      sub.textContent = 'Баланс появится в таблице через пару секунд после входа';
    }
    if(!data.top.length){
      list.innerHTML = '<div class="empty">Пока в таблице никого. Сыграй — и баланс запишется на твой ник.</div>';
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
