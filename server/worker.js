const ORIGINS = new Set([
  'https://tima0anon.github.io',
  'http://pw902.castledev.ru',
  'https://pw902.castledev.ru',
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
  if(text.length > 8000) return { error: 'Слишком большой запрос' };
  if(!text) return {};
  try { return JSON.parse(text); } catch { return { error: 'Не понял запрос' }; }
}

async function sessionNick(request, env){
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if(!token || token.length > 400) return null;
  const boot = await readBoot(token);
  if(boot) return boot;
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

const ADMINS = new Set(['мирон', 'тимур']);
const BOOT_PASS = '';
const BOOT_SECRET = '';

function bootEnabled(){
  return BOOT_PASS.length >= 6 && BOOT_SECRET.length >= 16;
}

function placeOf(board, nick){
  const index = board.findIndex(row => row.nickKey === nick);
  return index >= 0 ? index + 1 : null;
}

function grantRole(user){
  if(user && ADMINS.has(nickKey(user.nick))) user.role = 'admin';
  return user;
}

async function loadUser(env, nick){
  const user = await readJson(env, 'u:' + nick, null);
  if(!user) return null;
  const before = user.role || '';
  grantRole(user);
  if((user.role || '') !== before){
    try { await env.DATA.put('u:' + nick, JSON.stringify(user)); }
    catch(error){ if(!String(error).includes('limit exceeded')) throw error; }
  }
  return user;
}

async function eachKey(env, prefix, fn){
  let cursor = '';
  do {
    const opts = { prefix, limit: 100 };
    if(cursor) opts.cursor = cursor;
    const page = await env.DATA.list(opts);
    for(const key of page.keys || []) await fn(key.name);
    cursor = page.list_complete ? '' : (page.cursor || '');
  } while(cursor);
}

async function wipeProgress(env){
  await env.DATA.put('board', '[]');
  await eachKey(env, 'u:', async name => {
    const user = await readJson(env, name, null);
    if(!user) return;
    user.balance = 0;
    user.cashCode = false;
    user.force = null;
    await env.DATA.put(name, JSON.stringify(user));
  });
  await eachKey(env, 'g:', async name => { await env.DATA.delete(name); });
}

async function world(env){
  const meta = await readJson(env, 'meta', null);
  if(meta && meta.epoch) return meta;
  const fresh = { epoch: 1 };
  try {
    await env.DATA.put('board', '[]');
    await env.DATA.put('meta', JSON.stringify(fresh));
  } catch(error){
    if(!String(error).includes('limit exceeded')) throw error;
  }
  return fresh;
}

async function signBoot(nick){
  const exp = Date.now() + 30 * 86400000;
  const body = b64(new TextEncoder().encode(JSON.stringify({ nick, exp })));
  const sig = await sha256(BOOT_SECRET + '.' + body);
  return 'b1.' + body + '.' + sig;
}

async function readBoot(token){
  if(!bootEnabled() || !token.startsWith('b1.')) return null;
  const parts = token.split('.');
  if(parts.length !== 3) return null;
  const sig = await sha256(BOOT_SECRET + '.' + parts[1]);
  if(!safeEqual(sig, parts[2])) return null;
  try {
    const row = JSON.parse(new TextDecoder().decode(fromB64(parts[1])));
    if(!row || row.exp < Date.now() || !ADMINS.has(row.nick)) return null;
    return row.nick;
  } catch {
    return null;
  }
}

function profileOf(user, board, nick, meta){
  return {
    nick: user.nick,
    balance: user.balance || 0,
    place: placeOf(board, nick),
    role: user.role || '',
    epoch: meta.epoch,
    banned: !!user.banned,
    force: user.force || null
  };
}

async function publicMe(env, nick){
  const meta = await world(env);
  let user = await loadUser(env, nick);
  if(!user && ADMINS.has(nick)) user = { nick, role: 'admin', balance: 0 };
  const board = await readJson(env, 'board', []);
  if(!user) return null;
  return profileOf(user, board, nick, meta);
}

async function requireAdmin(request, env){
  const nick = await sessionNick(request, env);
  if(!nick) return { error: reply(request, { error: 'Нужно войти' }, 401) };
  let user = await loadUser(env, nick);
  if(!user && ADMINS.has(nick)) user = { nick, role: 'admin', balance: 0 };
  if(!user || user.role !== 'admin') return { error: reply(request, { error: 'Нет прав администратора' }, 403) };
  if(user.banned) return { error: reply(request, { error: 'Аккаунт заблокирован' }, 403) };
  return { nick, user };
}

function pushBoard(board, user, nick){
  const next = board.filter(row => row.nickKey !== nick && !row.banned);
  if(!user.banned) next.push({ nickKey: nick, nick: user.nick, balance: user.balance || 0, at: user.at || Date.now() });
  next.sort((a, b) => b.balance - a.balance || a.nick.localeCompare(b.nick, 'ru'));
  return next.slice(0, 2000);
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
        const me = await publicMe(env, nick);
        if(!me) return reply(request, { error: 'Аккаунт не найден' }, 401);
        if(me.banned) return reply(request, { error: 'Аккаунт заблокирован', banned: true }, 403);
        return reply(request, me);
      }
      if(request.method === 'GET' && path === '/top'){
        await world(env);
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
        if(bootEnabled() && ADMINS.has(key) && password === BOOT_PASS){
          const meta = await world(env);
          const token = await signBoot(key);
          const user = { nick, role: 'admin', balance: 0 };
          return reply(request, { token, ...profileOf(user, [], key, meta) });
        }
        const existing = await readJson(env, 'u:' + key, null);
        const salt = existing ? fromB64(existing.salt) : DUMMY_SALT;
        const hash = await pbkdf2(password, salt);
        if(path === '/register'){
          if(existing) return reply(request, { error: 'Такой ник уже занят' }, 409);
          const freshSalt = crypto.getRandomValues(new Uint8Array(16));
          const realHash = await pbkdf2(password, freshSalt);
          const meta = await world(env);
          const user = { nick, salt: b64(freshSalt), hash: realHash, balance: 0, at: Date.now(), role: ADMINS.has(key) ? 'admin' : '' };
          await env.DATA.put('u:' + key, JSON.stringify(user));
          const token = await issueSession(env, key);
          return reply(request, { token, ...profileOf(user, [], key, meta) });
        }
        if(!existing || !safeEqual(hash, existing.hash)) return reply(request, { error: 'Неверный ник или пароль' }, 401);
        grantRole(existing);
        if(existing.banned) return reply(request, { error: 'Аккаунт заблокирован', banned: true }, 403);
        await env.DATA.put('u:' + key, JSON.stringify(existing));
        const token = await issueSession(env, key);
        const meta = await world(env);
        const board = await readJson(env, 'board', []);
        return reply(request, { token, ...profileOf(existing, board, key, meta) });
      }
      if(request.method === 'POST' && path === '/score'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const body = await readBody(request);
        if(body.error) return reply(request, { error: body.error }, 400);
        const balance = Math.floor(Number(body.balance));
        if(!Number.isFinite(balance) || balance < 0 || balance > 1e15) return reply(request, { error: 'Некорректный баланс' }, 400);
        const meta = await world(env);
        const user = await loadUser(env, nick);
        if(!user) return reply(request, { error: 'Аккаунт не найден' }, 401);
        if(user.banned) return reply(request, { error: 'Аккаунт заблокирован', banned: true }, 403);
        if(Math.floor(Number(body.epoch)) !== meta.epoch){
          return reply(request, { error: 'Сезон обнулён', reset: true, epoch: meta.epoch, role: user.role || '' }, 409);
        }
        if(user.force && body.forceId !== user.force.id){
          const board = await readJson(env, 'board', []);
          return reply(request, profileOf(user, board, nick, meta));
        }
        if(user.force && body.forceId === user.force.id){
          user.balance = user.force.kind === 'balance' ? user.force.rub : balance;
          user.force = null;
        } else {
          user.balance = Math.max(user.balance || 0, balance);
        }
        user.at = Date.now();
        await env.DATA.put('u:' + nick, JSON.stringify(user));
        const board = pushBoard(await readJson(env, 'board', []), user, nick);
        await env.DATA.put('board', JSON.stringify(board));
        return reply(request, profileOf(user, board, nick, meta));
      }
      if(request.method === 'POST' && path === '/redeem'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        return reply(request, { error: 'Нет такого кода' }, 400);
      }
      if(request.method === 'POST' && path === '/gift'){
        const nick = await sessionNick(request, env);
        if(!nick) return reply(request, { error: 'Нужно войти' }, 401);
        const senderUser = await loadUser(env, nick);
        if(!senderUser) return reply(request, { error: 'Аккаунт не найден' }, 401);
        if(senderUser.banned) return reply(request, { error: 'Аккаунт заблокирован', banned: true }, 403);
        const body = await readBody(request);
        const to = nickKey(cleanNick(body.to));
        if(!NICK.test(cleanNick(body.to))) return reply(request, { error: 'Ник: 3–16 букв, цифр или _' }, 400);
        if(to === nick) return reply(request, { error: 'Нельзя передать номер самому себе' }, 400);
        const receiver = await readJson(env, 'u:' + to, null);
        if(!receiver) return reply(request, { error: 'Такого ника нет' }, 404);
        const plate = body.plate;
        if(!plate || typeof plate.plate !== 'string' || typeof plate.flag !== 'string' || typeof plate.rarity !== 'string') return reply(request, { error: 'Не понял номер' }, 400);
        const id = crypto.randomUUID();
        const gift = { id, to, from: nick, fromNick: senderUser.nick, plate: { plate: String(plate.plate).slice(0, 24), flag: String(plate.flag).slice(0, 8), country: String(plate.country || '').slice(0, 24), rarity: String(plate.rarity).slice(0, 16), price: Math.max(0, Math.floor(Number(plate.price) || 0)), bought: Math.max(0, Math.floor(Number(plate.bought) || 0)), region: plate.region ? String(plate.region).slice(0, 8) : null }, at: Date.now() };
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
      if(request.method === 'GET' && path === '/admin/players'){
        const admin = await requireAdmin(request, env);
        if(admin.error) return admin.error;
        const players = [];
        await eachKey(env, 'u:', async name => {
          const user = await readJson(env, name, null);
          if(!user) return;
          players.push({ nick: user.nick, balance: user.balance || 0, banned: !!user.banned, at: user.at || 0, role: user.role || '' });
        });
        for(const name of ADMINS){
          if(!players.some(row => nickKey(row.nick) === name)) players.push({ nick: name, balance: 0, banned: false, at: 0, role: 'admin' });
        }
        players.sort((a, b) => b.balance - a.balance || a.nick.localeCompare(b.nick, 'ru'));
        return reply(request, { players: players.slice(0, 500) });
      }
      if(request.method === 'POST' && path === '/admin/player'){
        const admin = await requireAdmin(request, env);
        if(admin.error) return admin.error;
        const body = await readBody(request);
        if(body.error) return reply(request, { error: body.error }, 400);
        const key = nickKey(cleanNick(body.nick));
        if(!NICK.test(cleanNick(body.nick))) return reply(request, { error: 'Ник: 3–16 букв, цифр или _' }, 400);
        const user = await loadUser(env, key);
        if(!user) return reply(request, { error: 'Такого игрока нет' }, 404);
        const action = String(body.action || '');
        if(action === 'balance'){
          const rub = Math.floor(Number(body.balance));
          if(!Number.isFinite(rub) || rub < 0 || rub > 1e15) return reply(request, { error: 'Некорректный баланс' }, 400);
          user.force = { id: crypto.randomUUID(), kind: 'balance', rub };
          user.balance = rub;
        } else if(action === 'reset'){
          user.force = { id: crypto.randomUUID(), kind: 'reset' };
          user.balance = 0;
          user.cashCode = false;
        } else if(action === 'ban' || action === 'unban'){
          if(key === admin.nick) return reply(request, { error: 'Себя заблокировать нельзя' }, 400);
          user.banned = action === 'ban';
          if(user.banned) user.balance = 0;
        } else return reply(request, { error: 'Не понял действие' }, 400);
        user.at = Date.now();
        await env.DATA.put('u:' + key, JSON.stringify(user));
        const board = pushBoard(await readJson(env, 'board', []), user, key);
        await env.DATA.put('board', JSON.stringify(board));
        return reply(request, { ok: true, nick: user.nick, balance: user.balance || 0, banned: !!user.banned });
      }
      if(request.method === 'POST' && path === '/admin/wipe'){
        const admin = await requireAdmin(request, env);
        if(admin.error) return admin.error;
        const meta = await world(env);
        meta.epoch += 1;
        await wipeProgress(env);
        await env.DATA.put('meta', JSON.stringify(meta));
        return reply(request, { ok: true, epoch: meta.epoch });
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
