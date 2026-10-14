import { adminAct, adminWipe, fetchPlayers } from '../../services/remote.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { paintTestBench } from './bench.js';
import { syncAdminNav } from '../shell/secrets.js';

function esc(value){
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function when(ts){
  if(!ts) return 'ещё не заходил';
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

let rows = [];

function paint(){
  const host = document.getElementById('adminList');
  if(!host) return;
  const query = (document.getElementById('adminSearch')?.value || '').trim().toLowerCase();
  const shown = rows.filter(row => !query || row.nick.toLowerCase().includes(query));
  if(!shown.length){ host.innerHTML = '<div class="empty">Игроков нет</div>'; return; }
  host.innerHTML = shown.map(row => {
    const staff = row.role === 'admin';
    const money = Number(row.balance || 0).toLocaleString('ru-RU');
    const plates = Number(row.plates || 0).toLocaleString('ru-RU');
    return `
    <div class="admin-row${row.banned ? ' is-banned' : ''}${row.hidden ? ' is-hidden' : ''}">
      <div class="admin-who">
        <b>${esc(row.nick)}</b>
        <span>${staff ? 'админ · ' : ''}${row.banned ? 'бан · ' : ''}${row.hidden ? 'скрыт из топа · ' : ''}${money} ₽ · ${plates} номеров · ${esc(when(row.at))}</span>
      </div>
      <div class="admin-actions">
        <input data-balance="${esc(row.nick)}" inputmode="numeric" value="${Number(row.balance || 0)}">
        <button type="button" class="ios-btn" data-act="balance" data-nick="${esc(row.nick)}">Поставить</button>
        <input data-grant="${esc(row.nick)}" inputmode="numeric" placeholder="+ сумма">
        <button type="button" class="ios-btn gold" data-act="grant" data-nick="${esc(row.nick)}">Начислить</button>
        ${staff ? '' : `
          <button type="button" class="ios-btn gray" data-act="garage" data-nick="${esc(row.nick)}">Гараж</button>
          <button type="button" class="ios-btn gray" data-act="kick" data-nick="${esc(row.nick)}">Выкинуть</button>
          <button type="button" class="ios-btn gray" data-act="${row.hidden ? 'show' : 'hide'}" data-nick="${esc(row.nick)}">${row.hidden ? 'В топ' : 'Скрыть'}</button>
          <button type="button" class="ios-btn gray" data-act="reset" data-nick="${esc(row.nick)}">На старт</button>
          <button type="button" class="ios-btn ${row.banned ? 'gold' : 'red'}" data-act="${row.banned ? 'unban' : 'ban'}" data-nick="${esc(row.nick)}">${row.banned ? 'Разбан' : 'Бан'}</button>
        `}
      </div>
    </div>`;
  }).join('');
}

const ACTION_NOTE = {
  balance: 'Баланс записан',
  grant: 'Деньги начислены',
  reset: 'Игрок сброшен на старт',
  ban: 'Игрок заблокирован',
  unban: 'Блок снят',
  garage: 'Гараж очищен',
  kick: 'Игрок выкинут из входа',
  hide: 'Игрок скрыт из топа',
  show: 'Игрок снова в топе',
};

export async function renderAdmin(){
  syncAdminNav();
  const bench = document.getElementById('testBench');
  const remote = document.getElementById('remoteAdmin');
  const locked = document.getElementById('adminLocked');
  const staff = document.getElementById('adminNav') && !document.getElementById('adminNav').hidden;
  if(bench) bench.hidden = !staff;
  if(remote) remote.hidden = !staff;
  if(locked) locked.hidden = staff;
  if(!staff) return;
  paintTestBench();
  const host = document.getElementById('adminList');
  if(host) host.innerHTML = '<div class="empty">Собираю игроков…</div>';
  try {
    const data = await fetchPlayers();
    rows = data.players || [];
    paint();
  } catch(error){
    if(host) host.innerHTML = '<div class="empty">' + esc(error.message || 'Список не открылся') + '</div>';
  }
}

async function run(nick, action, balance){
  await adminAct({ nick, action, balance });
  Sound.click();
  notify(ACTION_NOTE[action] || 'Готово');
  await renderAdmin();
}

export function bindAdmin(){
  const search = document.getElementById('adminSearch');
  if(search) search.addEventListener('input', paint);
  document.getElementById('adminRefresh')?.addEventListener('click', () => { Sound.click(); renderAdmin(); });
  document.getElementById('adminWipe')?.addEventListener('click', async () => {
    if(!confirm('Обнулить всех игроков до старта? Гаражи, деньги и топ сотрутся.')) return;
    try {
      await adminWipe();
      Sound.click();
      notify('Сезон обнулён');
      location.reload();
    } catch(error){
      notify(error.message || 'Не вышло');
      Sound.error();
    }
  });
  document.getElementById('adminList')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-act]');
    if(!button) return;
    const nick = button.dataset.nick;
    const action = button.dataset.act;
    let balance = 0;
    if(action === 'balance' || action === 'grant'){
      const input = document.querySelector((action === 'grant' ? '[data-grant="' : '[data-balance="') + CSS.escape(nick) + '"]');
      balance = Math.floor(Number(String(input?.value || '').replace(/\s/g, '')));
      if(!Number.isFinite(balance) || balance < 0 || (action === 'grant' && balance < 1)){
        notify(action === 'grant' ? 'Впиши сумму' : 'Впиши баланс');
        Sound.error();
        return;
      }
    }
    const asks = {
      balance: 'Поставить ' + nick + ' баланс ' + balance.toLocaleString('ru-RU') + ' ₽?',
      grant: 'Начислить ' + nick + ' ' + balance.toLocaleString('ru-RU') + ' ₽?',
      reset: 'Сбросить ' + nick + ' до старта?',
      ban: 'Заблокировать ' + nick + '?',
      garage: 'Очистить гараж у ' + nick + '?',
      kick: 'Выкинуть ' + nick + ' из входа?',
      hide: 'Скрыть ' + nick + ' из топа?',
    };
    if(asks[action] && !confirm(asks[action])) return;
    button.disabled = true;
    try { await run(nick, action, balance); }
    catch(error){ notify(error.message || 'Не вышло'); Sound.error(); }
    finally { button.disabled = false; }
  });
}
