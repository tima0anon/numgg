import { notify } from '../../services/notify.js';
import { Sound } from '../../services/audio.js';
import {
  clearSession,
  fetchMe,
  loginAccount,
  logoutAccount,
  queueScore,
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
  if(el) el.textContent = text || '';
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
  if(chip) chip.textContent = nick;
  const account = document.getElementById('rankAccount');
  if(account) account.textContent = nick + ' · в таблице баланс этого браузера';
  S.playerName = nick;
}

export function showGate(){
  const el = gate();
  if(el) el.hidden = false;
}

export function hideGate(){
  const el = gate();
  if(el) el.hidden = true;
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
    button.disabled = true;
    showError('');
    try {
      const result = mode === 'register' ? await registerAccount(nick, password) : await loginAccount(nick, password);
      writeSession(result);
      document.getElementById('authPass').value = '';
      showNick(result.nick);
      Sound.click();
      hideGate();
      queueScore(S.rub);
      if(pending){ const done = pending; pending = null; done(); }
    } catch(error){
      showError(error.message || 'Не получилось');
      Sound.error();
    } finally {
      button.disabled = false;
    }
  });
}

export function ensureSession(){
  bind();
  setMode('login');
  return new Promise(resolve => {
    const saved = readSession();
    if(!saved){ showGate(); pending = resolve; return; }
    showNick(saved.nick);
    fetchMe().then(me => {
      showNick(me.nick);
      hideGate();
      resolve();
    }).catch(error => {
      if(error.status === 401){
        clearSession();
        showGate();
        showError('Сессия истекла, войди снова');
        pending = resolve;
        return;
      }
      hideGate();
      notify('Рейтинг сейчас недоступен, игра открыта по сохранённому входу');
      resolve();
    });
  });
}
