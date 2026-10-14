import {
  NEWS_CHECK_INTERVAL,
  NEWS_LIFE_RANGE,
  NEWS_MAX_ACTIVE,
  NEWS_MIN_LIFE,
} from '../config/constants.js';

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list){
  return list[Math.floor(rand() * list.length)];
}

function pushItem(news, tpl, when, slot, mark, rand){
  let dur = NEWS_MIN_LIFE + Math.floor(rand() * NEWS_LIFE_RANGE);
  if(tpl.kind === 'bear') dur = Math.round(dur * 1.75);
  news.push({
    id: 's' + slot + mark,
    type: tpl.type,
    target: tpl.target,
    mult: tpl.mult,
    title: tpl.title,
    desc: tpl.desc,
    kind: tpl.kind,
    until: when + dur,
    startedAt: when,
  });
}

function fresh(news, templates, rand){
  const bears = templates.filter(t => t.kind === 'bear');
  const rest = templates.filter(t => t.kind !== 'bear');
  for(let attempt = 0; attempt < 24; attempt++){
    const pool = rand() < 0.55 && bears.length ? bears : (rest.length ? rest : templates);
    const tpl = pick(rand, pool);
    const exists = news.some(n => n.type === tpl.type && n.target === tpl.target && n.title === tpl.title);
    if(!exists) return tpl;
  }
  return null;
}

function ensureBulls(news, templates, when, slot, rand){
  let guard = 0;
  while(news.filter(n => n.kind === 'bull' && n.until > when).length < 3 && guard < 8){
    guard++;
    if(news.length >= NEWS_MAX_ACTIVE){
      const bearIdx = news.findIndex(n => n.kind === 'bear');
      if(bearIdx < 0) break;
      news.splice(bearIdx, 1);
    }
    const pool = templates.filter(t => t.kind === 'bull' && !news.some(n => n.type === t.type && n.target === t.target && n.title === t.title));
    if(!pool.length) break;
    pushItem(news, pick(rand, pool), when + guard, slot, 'b' + guard, rand);
  }
}

function step(news, templates, slot){
  const when = slot * NEWS_CHECK_INTERVAL;
  for(let i = news.length - 1; i >= 0; i--) if(news[i].until <= when) news.splice(i, 1);
  const rand = mulberry32((Math.imul(slot, 0x9E3779B1) ^ 0xA5A5A5A5) >>> 0);
  ensureBulls(news, templates, when, slot, rand);
  if(news.length >= NEWS_MAX_ACTIVE) return;
  const empty = news.length === 0;
  let slots = 0;
  if(empty) slots = 3;
  else if(news.length < 4 && rand() < 0.8) slots = 1;
  else if(rand() < 0.45) slots = 1;
  for(let i = 0; i < slots && news.length < NEWS_MAX_ACTIVE; i++){
    const tpl = fresh(news, templates, rand);
    if(!tpl) break;
    pushItem(news, tpl, when + i, slot, 'n' + i, rand);
  }
}

let cacheDay = -1;
let cursor = 0;
let tape = [];
let bound = null;

export function tapeAt(now, templates){
  const list = templates || bound;
  bound = list;
  const day = Math.floor(now / 86400000);
  const start = Math.floor(day * 86400000 / NEWS_CHECK_INTERVAL);
  const end = Math.floor(now / NEWS_CHECK_INTERVAL);
  if(cacheDay !== day || cursor > end + 1){
    cacheDay = day;
    cursor = start;
    tape = [];
  }
  while(cursor <= end){
    step(tape, list, cursor);
    cursor++;
  }
  return tape.filter(n => n.until > now).map(n => ({ ...n }));
}
