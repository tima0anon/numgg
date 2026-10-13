import { RARITY_ORDER, RMAP } from '../../config/rarity.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';
import {
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import { flashScreen, spawnConfetti } from '../../services/fx.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';
import {
  UP_MAX_CHANCE,
  UP_MAX_STAKE,
  UP_MIN_CHANCE,
  UP_RTP,
  beginRoll,
  findTarget,
  plateWorth,
  settleUpgrader,
} from './roll.js';

let picked = new Set();
let chance = 0.25;
let target = null;
let rolling = false;
let raf = 0;
let pickTimer = 0;
let wheelRot = 0;

function rub(n){ return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

function esc(s){
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}

function selectedPlates(){
  return S.col.filter(n => picked.has(Number(n.id)) && !n.listed && !n.favorite);
}

function stakeSum(){
  return selectedPlates().reduce((s, n) => s + plateWorth(n), 0);
}

function bestRarity(){
  const plates = selectedPlates();
  if(!plates.length) return 'common';
  return plates.reduce((best, n) => RARITY_ORDER.indexOf(n.rarity) > RARITY_ORDER.indexOf(best) ? n.rarity : best, 'common');
}

function syncChanceUI(){
  const pct = Math.round(chance * 100);
  const label = document.getElementById('upChance');
  const slider = document.getElementById('upSlider');
  if(label) label.textContent = pct + '%';
  if(slider && Number(slider.value) !== pct) slider.value = String(pct);
  paintWheel(chance);
}

function setChance(next){
  const clamped = Math.min(UP_MAX_CHANCE, Math.max(UP_MIN_CHANCE, next));
  chance = Math.round(clamped * 100) / 100;
  syncChanceUI();
  scheduleTarget();
}

function scheduleTarget(){
  clearTimeout(pickTimer);
  const mult = document.getElementById('upMult');
  const sum = stakeSum();
  if(mult){
    if(sum > 0) mult.textContent = 'Ищу номер около ' + rub(sum * UP_RTP / chance);
    else mult.textContent = 'Поставь номер, и появится цель';
  }
  pickTimer = setTimeout(refreshTarget, 180);
}

function refreshTarget(){
  if(rolling) return;
  const sum = stakeSum();
  if(sum <= 0){ target = null; paint(); return; }
  target = findTarget(sum, chance, bestRarity());
  paint();
}

function paintWheel(ratio){
  const wheel = document.getElementById('upWheel');
  if(!wheel || rolling) return;
  const share = Math.max(0.05, Math.min(0.75, ratio || chance));
  const mid = share * 180;
  wheelRot = (360 - mid) % 360;
  dressWheel(share, wheelRot);
}

function dressWheel(share, rot){
  const wheel = document.getElementById('upWheel');
  if(!wheel) return;
  wheel.style.setProperty('--win', (share * 100) + '%');
  wheel.style.transform = 'rotate(' + rot + 'deg)';
  const edge = document.getElementById('upEdgeEnd');
  if(edge) edge.style.transform = 'rotate(' + (share * 360) + 'deg)';
  placeMark('upMarkWin', share * 180, rot, share >= 0.1);
  placeMark('upMarkLose', share * 180 + 180, rot, share <= 0.9);
}

function placeMark(id, deg, rot, show){
  const el = document.getElementById(id);
  if(!el) return;
  el.hidden = !show;
  const rad = (deg - 90) * Math.PI / 180;
  el.style.left = (50 + Math.cos(rad) * 30) + '%';
  el.style.top = (50 + Math.sin(rad) * 30) + '%';
  el.style.transform = 'translate(-50%, -50%) rotate(' + (-rot) + 'deg)';
}

function landAngle(share, win){
  const winDeg = share * 360;
  const edge = Math.min(5, Math.max(1.2, winDeg * 0.12));
  if(win){
    if(winDeg <= edge * 2 || Math.random() < 0.2){
      return Math.random() < 0.5 ? edge * 0.45 : Math.max(edge * 0.45, winDeg - edge * 0.45);
    }
    return edge + Math.random() * (winDeg - edge * 2);
  }
  const loseStart = winDeg;
  if(Math.random() < 0.28){
    return Math.random() < 0.5
      ? Math.min(359, loseStart + 1.6 + Math.random() * 3.2)
      : 360 - (1.6 + Math.random() * 3.2);
  }
  const inner = Math.min(350, loseStart + 10);
  const outer = 350;
  if(outer <= inner) return Math.min(359, (loseStart + 360) / 2);
  return inner + Math.random() * (outer - inner);
}

function playWheel(shownChance, win){
  const wheel = document.getElementById('upWheel');
  if(!wheel) return Promise.resolve();
  const share = Math.max(0.01, Math.min(0.99, shownChance));
  const landing = (360 - landAngle(share, win)) % 360;
  const from = wheelRot;
  let to = landing;
  while(to < from + 360 * 4) to += 360;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = reduce ? 380 : 4600;
  const start = performance.now();
  const step = 20;
  let lastTick = Math.floor(from / step);
  cancelAnimationFrame(raf);
  return new Promise(resolve => {
    const frame = now => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      const angle = from + (to - from) * eased;
      dressWheel(share, angle);
      const tickAt = Math.floor(angle / step);
      if(tickAt !== lastTick){
        lastTick = tickAt;
        if(!reduce) Sound.tick();
      }
      if(t < 1) raf = requestAnimationFrame(frame);
      else {
        wheelRot = ((angle % 360) + 360) % 360;
        dressWheel(share, wheelRot);
        resolve();
      }
    };
    raf = requestAnimationFrame(frame);
  });
}

function cheer(rarity){
  const idx = RARITY_ORDER.indexOf(rarity);
  if(idx >= 6){ Sound.divine(); spawnConfetti(160); flashScreen(); haptic([60,40,60,40,120]); }
  else if(idx >= 4){ Sound.epic(); spawnConfetti(110); haptic([40,30,90]); }
  else if(idx >= 2){ Sound.rare(); spawnConfetti(70); haptic(30); }
  else { Sound.coin(); spawnConfetti(40); haptic(16); }
}

function showBanner(win){
  const banner = document.getElementById('upBanner');
  const reel = document.getElementById('upReel');
  if(reel){
    reel.classList.remove('is-win', 'is-lose');
    reel.classList.add(win ? 'is-win' : 'is-lose');
  }
  if(banner){
    banner.hidden = false;
    banner.className = 'up-banner ' + (win ? 'win' : 'lose');
    banner.textContent = win ? 'ЗАБРАЛ' : 'МИМО';
  }
}

function hideBanner(){
  const banner = document.getElementById('upBanner');
  const reel = document.getElementById('upReel');
  if(banner) banner.hidden = true;
  if(reel) reel.classList.remove('is-win', 'is-lose');
  document.getElementById('upStakeCol')?.classList.remove('is-burning');
  document.getElementById('upTargetCol')?.classList.remove('is-won');
}

function paint(){
  if(rolling) return;
  const sum = stakeSum();
  const sumEl = document.getElementById('upSum');
  if(sumEl) sumEl.textContent = rub(sum);
  const pickedEl = document.getElementById('upPicked');
  if(pickedEl){
    const plates = selectedPlates();
    pickedEl.innerHTML = plates.length
      ? plates.map(n => '<button type="button" class="up-pick" data-drop="'+n.id+'"><span>'+renderRealPlate(n.plate, n.flag, '')+'</span><b>'+rub(plateWorth(n))+'</b></button>').join('')
      : '<div class="up-empty">Нажми номера снизу. До шести, без избранного и без биржи.</div>';
    pickedEl.querySelectorAll('[data-drop]').forEach(b => b.addEventListener('click', () => {
      picked.delete(Number(b.dataset.drop));
      refreshTarget();
    }));
  }
  const targetEl = document.getElementById('upTarget');
  const livePrice = target ? plateWorth(target) : 0;
  const liveChance = target && sum > 0 ? (sum * UP_RTP) / livePrice : chance;
  if(targetEl){
    if(!target || sum <= 0){
      targetEl.innerHTML = '<div class="up-empty">'+(sum > 0 ? 'Под этот шанс нет номера дороже ставки.' : 'Цель подбирается под шанс.')+'</div>';
    } else {
      const R = RMAP[target.rarity];
      const mult = sum > 0 ? livePrice / sum : 0;
      targetEl.innerHTML = '<div class="up-prize">'+
        '<div class="plate-stage">'+renderRealPlate(target.plate, target.flag, 'md')+'</div>'+
        '<span class="rar '+target.rarity+'">'+(R ? R.name : '')+'</span>'+
        '<div class="card-price">'+rub(livePrice)+'<span>рынок цели</span></div>'+
        '<div class="who">×'+mult.toFixed(2)+' к ставке · '+target.country+'</div>'+
        '</div>';
    }
  }
  const multEl = document.getElementById('upMult');
  if(multEl){
    if(target && sum > 0 && chance - liveChance > 0.04) multEl.textContent = 'Дешевле этой цели рынок не даёт. Крутится реальный шанс.';
    else if(target && sum > 0) multEl.textContent = 'Отдача 88% · с рубля в среднем остаётся 88 копеек';
    else if(sum > 0) multEl.textContent = 'Подвинь шанс или сними часть ставки';
    else multEl.textContent = 'Поставь номер, и появится цель';
  }
  const shown = target && sum > 0 ? liveChance : chance;
  const pct = Math.round(shown * 1000) / 10;
  const label = document.getElementById('upChance');
  if(label) label.textContent = (target && sum > 0 ? pct.toFixed(1) : Math.round(chance * 100)) + '%';
  const go = document.getElementById('upGo');
  const why = document.getElementById('upWhy');
  let reason = '';
  if(sum <= 0) reason = 'Выбери хотя бы один номер.';
  else if(!target) reason = 'Для этой ставки нет цели в пределах 5–75%.';
  else if(liveChance < UP_MIN_CHANCE || liveChance > UP_MAX_CHANCE) reason = 'Шанс уехал за края. Подвинь ползунок.';
  if(go){
    go.disabled = !!reason;
    go.textContent = reason ? 'Крутить' : 'Крутить · ' + pct.toFixed(1) + '%';
  }
  if(why) why.textContent = reason;
  const stats = S.upgraderStats || { spins: 0, wins: 0 };
  const statsEl = document.getElementById('upStats');
  if(statsEl) statsEl.textContent = 'Круток ' + (stats.spins || 0) + ' · забрал ' + (stats.wins || 0);
  paintBag();
  paintLog();
  paintWheel(shown);
}

function paintBag(){
  const bag = document.getElementById('upBag');
  if(!bag) return;
  const plates = S.col.slice().sort((a, b) => plateWorth(a) - plateWorth(b)).slice(0, 48);
  if(!plates.length){
    bag.innerHTML = '<div class="up-empty">Гараж пуст. Сначала крутани дроп.</div>';
    return;
  }
  bag.innerHTML = plates.map(n => {
    const blocked = n.listed || n.favorite;
    const on = picked.has(Number(n.id));
    const note = n.listed ? 'на бирже' : n.favorite ? 'в избранном' : rub(plateWorth(n));
    return '<button type="button" class="up-lot'+(on?' on':'')+'" data-id="'+n.id+'"'+(blocked?' disabled':'')+'>'+
      renderRealPlate(n.plate, n.flag, '')+
      '<span class="rar '+n.rarity+'">'+RMAP[n.rarity].name+'</span>'+
      '<span class="who">'+note+'</span></button>';
  }).join('');
  bag.querySelectorAll('.up-lot:not(:disabled)').forEach(b => b.addEventListener('click', () => togglePick(Number(b.dataset.id))));
}

function paintLog(){
  const log = document.getElementById('upLog');
  if(!log) return;
  const rows = Array.isArray(S.upgraderLog) ? S.upgraderLog : [];
  if(!rows.length){ log.innerHTML = '<div class="up-empty">Пока тихо.</div>'; return; }
  log.innerHTML = rows.map(row => {
    const cls = row.win ? 'win' : 'lose';
    const verb = row.win ? 'Забрал' : 'Мимо';
    return '<div class="item '+cls+'"><span>'+verb+' '+esc(row.plate)+'</span><span>'+Math.round((row.chance || 0) * 100)+'% · '+rub(row.price || 0)+'</span></div>';
  }).join('');
}

function togglePick(id){
  if(rolling) return;
  if(picked.has(id)) picked.delete(id);
  else {
    if(selectedPlates().length >= UP_MAX_STAKE){ notify('За раз можно поставить не больше шести номеров.'); Sound.error(); return; }
    picked.add(id);
    Sound.click();
  }
  refreshTarget();
}

function afterSettle(){
  picked.clear();
  target = null;
  rolling = false;
  hideBanner();
  updateBalances();
  renderCollection();
  updateStats();
  updateAchievements();
  updateRarityStats();
  paint();
  save();
}

export function renderUpgrader(){
  if(!document.getElementById('page-upgrader')) return;
  const alive = new Set(S.col.map(n => Number(n.id)));
  picked.forEach(id => { if(!alive.has(id)) picked.delete(id); });
  if(!rolling) paint();
}

export function bindUpgrader(){
  const slider = document.getElementById('upSlider');
  if(!slider || slider.dataset.bound) return;
  slider.dataset.bound = '1';
  slider.addEventListener('input', () => {
    if(rolling){ slider.value = String(Math.round(chance * 100)); return; }
    setChance(Number(slider.value) / 100);
  });
  document.getElementById('upChanceDown').addEventListener('click', () => { if(!rolling) setChance(chance - 0.05); });
  document.getElementById('upChanceUp').addEventListener('click', () => { if(!rolling) setChance(chance + 0.05); });
  document.getElementById('upClear').addEventListener('click', () => {
    if(rolling) return;
    picked.clear();
    refreshTarget();
  });
  document.getElementById('upReroll').addEventListener('click', () => {
    if(rolling) return;
    Sound.click();
    refreshTarget();
  });
  document.getElementById('upGo').addEventListener('click', () => { spinUpgrader(); });
  syncChanceUI();
  paint();
}

export async function spinUpgrader(){
  if(rolling) return;
  const plates = selectedPlates();
  if(!plates.length || !target){ Sound.error(); return; }
  const result = beginRoll(plates.map(n => n.id), target);
  if(result.error){ notify(result.error); Sound.error(); paint(); return; }
  rolling = true;
  const go = document.getElementById('upGo');
  if(go){ go.disabled = true; go.textContent = 'Крутится…'; }
  document.getElementById('upStakeCol')?.classList.add('is-burning');
  if(result.win) document.getElementById('upTargetCol')?.classList.add('is-won');
  await playWheel(result.chance, result.win);
  showBanner(result.win);
  if(result.win) cheer(result.target.rarity);
  else { Sound.error(); haptic(40); }
  const pending = settleUpgrader();
  const won = pending && pending.win;
  notify(won ? 'Апргейдербета: ' + pending.target.plate + ' теперь в гараже' : 'Ставка сгорела');
  await new Promise(resolve => setTimeout(resolve, 1100));
  afterSettle();
}
