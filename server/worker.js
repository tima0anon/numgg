const ORIGINS = new Set([
  'https://tima0anon.github.io',
  'https://web2.castle-host.com',
  'https://fastdl.castle-host.com',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]);
const NICK = /^[\p{L}\p{N}_]{3,16}$/u;
const DUMMY_SALT = new Uint8Array(16);
const PBKDF2_ITERS = 25000;

function corsHeaders(origin){
  const allow = ORIGINS.has(origin) ? origin : 'https://tima0anon.github.io';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function reply(request, body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request.headers.get('origin') || '') },
  });
}

function b64(bytes){
  let text = '';
  for(const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromB64(text){
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function safeEqual(a, b){
  if(typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for(let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password, salt){
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' }, key, 256);
  return b64(new Uint8Array(bits));
}

async function sha256(text){
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readJson(env, key, fallback){
  const raw = await env.DATA.get(key);
  if(!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function cleanNick(value){
  return String(value || '').trim();
}

function nickKey(nick){
  return nick.toLowerCase();
}

async function readBody(request){
  const text = await request.text();
  if(text.length > 2000) return { error: 'Слишком большой запрос' };
  if(!text) return {};
  try { return JSON.parse(text); } catch { return { error: 'Не понял запрос' }; }
}

async function sessionNick(request, env){
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if(!token || token.length > 128) return null;
  const row = await readJson(env, 'sess:' + await sha256(token), null);
  if(!row || !row.nick || row.exp < Date.now()) return null;
  return row.nick;
}

async function issueSession(env, nick){
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = [...raw].map(b => b.toString(16).padStart(2, '0')).join('');
  const exp = Date.now() + 30 * 86400000;
  await env.DATA.put('sess:' + await sha256(token), JSON.stringify({ nick, exp }), { expirationTtl: 30 * 86400 });
  return token;
}

function placeOf(board, nick){
  const index = board.findIndex(row => row.nickKey === nick);
  return index >= 0 ? index + 1 : null;
}

async function publicMe(env, nick){
  const user = await readJson(env, 'u:' + nick, null);
  const board = await readJson(env, 'board', []);
  if(!user) return null;
  return { nick: user.nick, balance: user.balance || 0, place: placeOf(board, nick) };
}

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin') || '') });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if(request.method === 'GET' && path === '/health') return reply(request, { ok: true });
      if(request.method === 'GET' && path === '/me'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        return reply(request, await publicMe(env, nick));
      }
      if(request.method === 'GET' && path === '/top'){
        const board = await readJson(env, 'board', []);
        const top = board.slice(0, 100).map((row, index) => ({ nick: row.nick, balance: row.balance, place: index + 1 }));
        const nick = await sessionNick(request, env);
        const me = nick ? await publicMe(env, nick) : null;
        return reply(request, { top, me });
      }
      if(request.method === 'POST' && (path === '/register' || path === '/login')){
        const body = await readBody(request);
        if(body.error) return reply(request, { error: body.error }, 400);
        const nick = cleanNick(body.nick);
        const password = String(body.password || '');
        if(!NICK.test(nick)) return reply(request, { error: 'Ник: 3–16 букв, цифр или _' }, 400);
        if(password.length < 6 || password.length > 72) return reply(request, { error: 'Пароль: от 6 до 72 символов' }, 400);
        const key = nickKey(nick);
        const existing = await readJson(env, 'u:' + key, null);
        const salt = existing ? fromB64(existing.salt) : DUMMY_SALT;
        const hash = await pbkdf2(password, salt);
        if(path === '/register'){
          if(existing) return reply(request, { error: 'Такой ник уже занят' }, 409);
          const freshSalt = crypto.getRandomValues(new Uint8Array(16));
          const realHash = await pbkdf2(password, freshSalt);
          const user = { nick, salt: b64(freshSalt), hash: realHash, balance: 0, at: Date.now() };
          await env.DATA.put('u:' + key, JSON.stringify(user));
          const token = await issueSession(env, key);
          return reply(request, { token, nick, balance: 0, place: null });
        }
        if(!existing || !safeEqual(hash, existing.hash)) return reply(request, { error: 'Неверный ник или пароль' }, 401);
        const token = await issueSession(env, key);
        const board = await readJson(env, 'board', []);
        return reply(request, { token, nick: existing.nick, balance: existing.balance || 0, place: placeOf(board, key) });
      }
      if(request.method === 'POST' && path === '/score'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const body = await readBody(request);
        if(body.error) return reply(request, { error: body.error }, 400);
        const balance = Math.floor(Number(body.balance));
        if(!Number.isFinite(balance) || balance < 0 || balance > 1e15) return reply(request, { error: 'Некорректный баланс' }, 400);
        const user = await readJson(env, 'u:' + nick, null);
        if(!user) return reply(request, { error: 'Аккаунт не найден' }, 401);
        user.balance = Math.max(user.balance || 0, balance);
        user.at = Date.now();
        await env.DATA.put('u:' + nick, JSON.stringify(user));
        const board = await readJson(env, 'board', []);
        const next = board.filter(row => row.nickKey !== nick);
        next.push({ nickKey: nick, nick: user.nick, balance: user.balance, at: user.at });
        next.sort((a, b) => b.balance - a.balance || a.nick.localeCompare(b.nick, 'ru'));
        await env.DATA.put('board', JSON.stringify(next.slice(0, 2000)));
        return reply(request, { nick: user.nick, balance: user.balance, place: placeOf(next, nick) });
      }
      if(request.method === 'POST' && path === '/redeem'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const body = await readBody(request);
        if(String(body.code) !== '525262') return reply(request, { error: 'Нет такого кода' }, 400);
        const user = await readJson(env, 'u:' + nick, null);
        if(!user) return reply(request, { error: 'Аккаунт не найден' }, 401);
        if(user.cashCode) return reply(request, { error: 'Код уже использован на этом аккаунте', used: true }, 409);
        user.cashCode = true;
        await env.DATA.put('u:' + nick, JSON.stringify(user));
        return reply(request, { ok: true });
      }
      if(request.method === 'POST' && path === '/gift'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const body = await readBody(request);
        const to = nickKey(cleanNick(body.to));
        if(!NICK.test(cleanNick(body.to))) return reply(request, { error: 'Ник: 3–16 букв, цифр или _' }, 400);
        if(to === nick) return reply(request, { error: 'Нельзя передать номер самому себе' }, 400);
        const receiver = await readJson(env, 'u:' + to, null);
        if(!receiver) return reply(request, { error: 'Такого ника нет' }, 404);
        const plate = body.plate;
        if(!plate || typeof plate.plate !== 'string' || typeof plate.flag !== 'string' || typeof plate.rarity !== 'string') return reply(request, { error: 'Не понял номер' }, 400);
        const id = crypto.randomUUID();
        const sender = await readJson(env, 'u:' + nick, null);
        const gift = { id, to, from: nick, fromNick: sender ? sender.nick : nick, plate: { plate: String(plate.plate).slice(0, 24), flag: String(plate.flag).slice(0, 8), country: String(plate.country || '').slice(0, 24), rarity: String(plate.rarity).slice(0, 16), price: Math.max(0, Math.floor(Number(plate.price) || 0)), bought: Math.max(0, Math.floor(Number(plate.bought) || 0)), region: plate.region ? String(plate.region).slice(0, 8) : null }, at: Date.now() };
        await env.DATA.put('g:' + to + ':' + id, JSON.stringify(gift), { expirationTtl: 30 * 86400 });
        return reply(request, { ok: true, id });
      }
      if(request.method === 'GET' && path === '/inbox'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const listed = await env.DATA.list({ prefix: 'g:' + nick + ':' });
        const gifts = [];
        for(const key of listed.keys){
          const row = await readJson(env, key.name, null);
          if(row) gifts.push(row);
        }
        return reply(request, { gifts });
      }
      if(request.method === 'POST' && path === '/inbox/take'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const body = await readBody(request);
        const id = String(body.id || '');
        if(!id || id.length > 80) return reply(request, { error: 'Не понял посылку' }, 400);
        const key = 'g:' + nick + ':' + id;
        const gift = await readJson(env, key, null);
        if(!gift) return reply(request, { error: 'Посылки уже нет' }, 404);
        await env.DATA.delete(key);
        return reply(request, { plate: gift.plate, fromNick: gift.fromNick });
      }
      if(request.method === 'POST' && path === '/logout'){
        const header = request.headers.get('authorization') || '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if(token) await env.DATA.delete('sess:' + await sha256(token));
        return reply(request, { ok: true });
      }
      return reply(request, { error: 'Нет такого адреса' }, 404);
    } catch(error){
      return reply(request, { error: 'Сервер не справился' }, 500);
    }
  }
};
