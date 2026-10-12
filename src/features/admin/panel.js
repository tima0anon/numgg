import { adminAct, adminWipe, fetchPlayers } from '../../services/remote.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';

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
  host.innerHTML = shown.map(row => `
    <div class="admin-row${row.banned ? ' is-banned' : ''}">
      <div class="admin-who">
        <b>${esc(row.nick)}</b>
        <span>${row.role === 'admin' ? 'админ · ' : ''}${row.banned ? 'бан · ' : ''}${Number(row.balance || 0).toLocaleString('ru-RU')} ₽ · ${esc(when(row.at))}</span>
      </div>
      <div class="admin-actions">
        <input data-balance="${esc(row.nick)}" inputmode="numeric" value="${Number(row.balance || 0)}">
        <button type="button" class="ios-btn" data-act="balance" data-nick="${esc(row.nick)}">Баланс</button>
        <button type="button" class="ios-btn gray" data-act="reset" data-nick="${esc(row.nick)}">На старт</button>
        <button type="button" class="ios-btn ${row.banned ? 'gold' : 'red'}" data-act="${row.banned ? 'unban' : 'ban'}" data-nick="${esc(row.nick)}">${row.banned ? 'Разбан' : 'Бан'}</button>
      </div>
    </div>
  `).join('');
}

export async function renderAdmin(){
  const host = document.getElementById('adminList');
  if(host) host.innerHTML = '<div class="empty">Загружаю игроков…</div>';
  try {
    const data = await fetchPlayers();
    rows = data.players || [];
    paint();
  } catch(error){
    if(host) host.innerHTML = '<div class="empty">' + esc(error.message || 'Не удалось загрузить') + '</div>';
  }
}

async function run(nick, action, balance){
  await adminAct({ nick, action, balance });
  Sound.click();
  notify(action === 'balance' ? 'Баланс записан' : action === 'reset' ? 'Игрок сброшен на старт' : action === 'ban' ? 'Игрок заблокирован' : 'Блок снят');
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
    if(action === 'balance'){
      const input = document.querySelector('[data-balance="' + CSS.escape(nick) + '"]');
      balance = Math.floor(Number(String(input?.value || '').replace(/\s/g, '')));
      if(!Number.isFinite(balance) || balance < 0){ notify('Впиши баланс'); Sound.error(); return; }
    }
    if(action === 'reset' && !confirm('Сбросить ' + nick + ' до старта?')) return;
    if(action === 'ban' && !confirm('Заблокировать ' + nick + '?')) return;
    button.disabled = true;
    try { await run(nick, action, balance); }
    catch(error){ notify(error.message || 'Не вышло'); Sound.error(); }
    finally { button.disabled = false; }
  });
}
