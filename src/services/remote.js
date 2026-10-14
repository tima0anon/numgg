import { SOCIAL_PAUSED } from '../config/constants.js';
const SESSION_KEY = 'numdrop_session_v1';

export function apiBase(){
  const host = location.hostname;
  if(host === 'numdrop.online' || host.endsWith('swtest.ru')) return location.origin + '/api';
  return 'https://numdrop.online/api';
}

export function readSession(){
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || typeof data.token !== 'string' || typeof data.nick !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSession(data){
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: data.token, nick: data.nick }));
}

export function clearSession(){
  localStorage.removeItem(SESSION_KEY);
}

async function call(path, { method, body, auth } = {}){
  const headers = {};
  if(body) headers['content-type'] = 'application/json';
  if(auth){
    const session = readSession();
    if(session) headers.authorization = 'Bearer ' + session.token;
  }
  let response;
  try {
    response = await fetch(apiBase() + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    const error = new Error('Нет связи с сервером рейтинга');
    error.status = 0;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if(!response.ok){
    const error = new Error(data.error || 'Сервер отклонил запрос');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export function registerAccount(nick, password){
  return call('/register', { body: { nick, password } });
}

export function loginAccount(nick, password){
  return call('/login', { body: { nick, password } });
}

export function fetchMe(withSave){
  return call('/me' + (withSave ? '?save=1' : ''), { auth: true });
}

let cloudTimer = 0;
export function queueCloudSave(payload){
  if(SOCIAL_PAUSED || !readSession() || !payload) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    call('/save', { body: { save: payload }, auth: true }).catch(() => {});
  }, 1200);
}

export function fetchPlayers(){
  return call('/admin/players', { auth: true });
}

export function adminAct(body){
  return call('/admin/player', { body, auth: true });
}

export function adminWipe(){
  return call('/admin/wipe', { body: {}, auth: true });
}

export function fetchTop(){
  return call('/top', { auth: true });
}

export function sendPlate(to, plate){
  return call('/gift', { body: { to, plate }, auth: true });
}

export function fetchInbox(){
  return call('/inbox', { auth: true });
}

export function takeGift(id){
  return call('/inbox/take', { body: { id }, auth: true });
}

export function logoutAccount(){
  const session = readSession();
  clearSession();
  if(!session) return Promise.resolve();
  return fetch(apiBase() + '/logout', { method: 'POST', headers: { authorization: 'Bearer ' + session.token } }).catch(() => {});
}

let profileListener = () => {};
export function watchProfile(fn){ profileListener = fn; }

function emitProfile(data){
  if(data) profileListener(data);
}

let scoreTimer = 0;
export function queueScore(balance, epoch, forceId){
  if(SOCIAL_PAUSED || !readSession()) return;
  clearTimeout(scoreTimer);
  scoreTimer = setTimeout(() => {
    call('/score', { body: { balance: Math.floor(balance), epoch: epoch || 0, forceId: forceId || '' }, auth: true }).then(row => {
      emitProfile(row);
      const page = document.getElementById('page-rank');
      if(page && page.classList.contains('active')){
        const place = document.getElementById('rankPlace');
        if(place && row.place) place.textContent = row.place + ' место';
      }
    }).catch(error => {
      if(error.payload && error.payload.reset) emitProfile(error.payload);
    });
  }, 2500);
}
