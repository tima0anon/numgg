import { notify } from '../../services/notify.js';
import { Sound } from '../../services/audio.js';
import {
  clearSession,
  fetchMe,
  loginAccount,
  logoutAccount,
  readSession,
  registerAccount,
  writeSession,
} from '../../services/remote.js';
import { S } from '../../state/player.js';

let mode = 'login';
let pending = null;

function gate(){ return document.getElementById('authGate'); }

function showError(text){
  const el = document.getElementById('authError');
  if(!el) return;
  el.textContent = text || '';
  el.classList.remove('is-on');
  if(text) requestAnimationFrame(() => el.classList.add('is-on'));
}

function setMode(next){
  mode = next;
  document.getElementById('authTabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('authTabReg').classList.toggle('active', mode === 'register');
  document.getElementById('authSubmit').textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
  document.getElementById('authPass').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  showError('');
}

function showNick(nick){
  const chip = document.getElementById('accountChip');
  if(chip){ chip.hidden = false; chip.textContent = nick; }
  const account = document.getElementById('rankAccount');
  if(account) account.textContent = nick + ' · место в топе по максимальному балансу';
  S.playerName = nick;
}

export function showGate(){
  const el = gate();
  if(!el) return;
  el.hidden = false;
  el.classList.remove('is-leaving');
  requestAnimationFrame(() => el.classList.add('is-open'));
}

export function hideGate(){
  const el = gate();
  if(!el) return;
  el.classList.remove('is-open');
  el.classList.add('is-leaving');
  setTimeout(() => { if(!el.classList.contains('is-open')) el.hidden = true; }, 520);
}

export function logoutToGate(){
  logoutAccount();
  showGate();
  showError('');
  notify('Ты вышел из аккаунта');
}

function bind(){
  document.getElementById('authTabLogin').addEventListener('click', () => setMode('login'));
  document.getElementById('authTabReg').addEventListener('click', () => setMode('register'));
  document.getElementById('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const nick = document.getElementById('authNick').value;
    const password = document.getElementById('authPass').value;
    const button = document.getElementById('authSubmit');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Секунду…';
    showError('');
    try {
      const result = mode === 'register' ? await registerAccount(nick, password) : await loginAccount(nick, password);
      writeSession(result);
      document.getElementById('authPass').value = '';
      const me = typeof result.epoch === 'number' ? result : await fetchMe(true);
      showNick(me.nick);
      Sound.click();
      hideGate();
      if(pending){ const done = pending; pending = null; done(me); }
    } catch(error){
      showError(error.payload?.banned ? 'Аккаунт заблокирован' : (error.message || 'Не получилось'));
      Sound.error();
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

export function ensureSession(){
  bind();
  setMode('login');
  showGate();
  return new Promise(resolve => {
    const saved = readSession();
    if(!saved){ pending = resolve; return; }
    showNick(saved.nick);
    fetchMe(true).then(me => {
      if(me.banned){
        clearSession();
        showError('Аккаунт заблокирован');
        pending = resolve;
        return;
      }
      showNick(me.nick);
      hideGate();
      resolve(me);
    }).catch(error => {
      if(error.status === 401 || error.payload?.banned){
        clearSession();
        showError(error.payload?.banned ? 'Аккаунт заблокирован' : 'Сессия истекла, войди снова');
      } else if(error.status !== 401){
        showError('Сервер молчит. Подожди немного и попробуй ещё раз');
        pending = resolve;
        return;
      } else {
        showError('Сессия истекла, войди снова');
      }
      pending = resolve;
    });
  });
}
