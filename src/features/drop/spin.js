import {
  HISTORY_MAX,
  MAX_CUSTOM_SPIN,
  SPIN_COST_ALL,
  SPIN_COST_SINGLE,
} from '../../config/constants.js';
import {
  RARITY,
  RARITY_ORDER,
  RMAP,
} from '../../config/rarity.js';
import {
  WEALTH_TIERS,
  wealthTierIdx,
} from '../../config/wealth.js';
import {
  isRecentPlate,
  rememberPlate,
} from '../../domain/memory.js';
import {
  COUNTRIES,
  extractRegion,
} from '../../domain/plates/countries.js';
import { renderRealPlate } from '../../domain/plates/render.js';
import { hypoPrice } from '../../domain/pricing.js';
import { rnd } from '../../domain/random.js';
import { stopAutoSpin } from './autospin.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';
import {
  renderHistory,
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../hud/stats.js';
import { Sound } from '../../services/audio.js';
import {
  flashScreen,
  spawnConfetti,
} from '../../services/fx.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

// DROP
export function baseSpinCost(){ return S.selectedCountry==='all' ? SPIN_COST_ALL : SPIN_COST_SINGLE; }

export function currentSpinCost(){ return baseSpinCost(); }

export function discountFor(n){
  if(n>=1000) return 0.70;
  if(n>=500) return 0.75;
  if(n>=100) return 0.80;
  if(n>=50) return 0.85;
  if(n>=10) return 0.90;
  if(n>=5) return 0.95;
  return 1;
}

export function bulkCost(n){ return Math.floor(currentSpinCost() * n * discountFor(n)); }

export function pickRarity(){
  const ll = S.luckLvl;
  const commonMul = Math.max(0.6, 1 - ll*0.04);
  const otherMul = 1 + ll*0.04;
  const ws = RARITY.map(r => ({ id:r.id, w: r.id==='common' ? r.w*commonMul : r.w*otherMul }));
  const total = ws.reduce((a,b)=>a+b.w, 0);
  let r = Math.random()*total;
  for(const x of ws){ if(r < x.w) return x.id; r -= x.w; }
  return 'common';
}

export function generateNumber(forceAll){
  const rid = pickRarity();
  let cd;
  if(forceAll || S.selectedCountry==='all') cd = rnd(COUNTRIES);
  else cd = COUNTRIES.find(c => c.id === S.selectedCountry) || rnd(COUNTRIES);
  let res, attempts=0;
  do { res = cd.gen(rid); attempts++; } while(isRecentPlate(res.plate, cd.flag) && attempts < 40);
  rememberPlate(res.plate, cd.flag);
  const region = extractRegion(res.plate, cd.flag);
  return { id: S.nextId++, country: cd.name, flag: cd.flag, plate: res.plate, rarity: rid, price: hypoPrice(rid, cd.flag, region), favorite: false, region };
}

export function cooldownMs(){ return Math.max(500, 3000 - Math.min(S.cdLvl*300, 2500)); }

export function updateCd(){
  const el = document.getElementById('cd');
  if(!el) return;
  if(flags.spinning){ el.textContent = 'Дроп...'; el.classList.remove('no-money'); return; }
  const cost = bulkCost(1);
  if(S.rub < cost){ el.textContent = 'Недостаточно средств (нужно '+cost+' ₽)'; el.classList.add('no-money'); return; }
  el.classList.remove('no-money');
  const left = cooldownMs() - (Date.now() - S.lastSpin);
  if(left > 0) el.textContent = 'Подожди '+(left/1000).toFixed(1)+' с';
  else el.textContent = S.autoSpin ? 'Автопрокрут активен' : 'Готов к дропу';
}

export function readCustomSpinN(){
  const inp = document.getElementById('customSpinCount');
  if(!inp) return S.customSpinN || 1;
  let n = parseInt(inp.value, 10);
  if(!isFinite(n) || n < 1) n = 1;
  if(n > MAX_CUSTOM_SPIN) n = MAX_CUSTOM_SPIN;
  return n;
}

export function updateWealthBadgeUI(){
  const idx = wealthTierIdx(S.rub);
  const tier = WEALTH_TIERS[idx];
  const badge = document.getElementById('wealthBadge');
  if(badge){ badge.className = 'wealth-badge tier-'+idx; badge.textContent = tier.emoji+' '+tier.label; }
  const rankPill = document.getElementById('rankPill');
  if(rankPill){ rankPill.className = 'rank-pill tier-'+idx; rankPill.innerHTML = '<span class="rp-emoji">'+tier.emoji+'</span><span class="rp-label">'+tier.label+'</span>'; }
  const pill = document.getElementById('balancePill');
  if(pill) pill.className = 'balance-pill' + (idx>0 ? ' tier-'+idx : ' tier-0');
  flags.lastWealthIdx = idx;
}

export function updateDropCostsUI(){
  document.getElementById('cost1').textContent = bulkCost(1).toLocaleString('ru-RU');
  document.getElementById('cost5').textContent = bulkCost(5).toLocaleString('ru-RU');
  document.getElementById('cost10').textContent = bulkCost(10).toLocaleString('ru-RU');
  const n = readCustomSpinN();
  document.getElementById('costN').textContent = bulkCost(n).toLocaleString('ru-RU');
  document.getElementById('dropCostLabel').textContent = bulkCost(1).toLocaleString('ru-RU')+' ₽';
  const hint = document.getElementById('dropCostHint');
  if(S.selectedCountry==='all') hint.textContent = 'за дроп · все страны';
  else { const c = COUNTRIES.find(x=>x.id===S.selectedCountry); hint.textContent = '+33% · '+(c?c.name:''); }
  updateWealthBadgeUI();
  updateDropButtons();
}

export function updateDropButtons(){
  const can1 = S.rub >= bulkCost(1);
  const can5 = S.rub >= bulkCost(5);
  const can10 = S.rub >= bulkCost(10);
  document.getElementById('spin1').disabled = flags.spinning || !can1;
  document.getElementById('spin5').disabled = flags.spinning || !can5;
  document.getElementById('spin10').disabled = flags.spinning || !can10;
  const cb = document.getElementById('spinCustom');
  if(cb){ const n = readCustomSpinN(); cb.disabled = flags.spinning || S.rub < bulkCost(n); }
}

export function randomSpinFrame(){
  const flag = S.selectedCountry==='all' ? rnd(COUNTRIES).flag : S.selectedCountry;
  const cData = COUNTRIES.find(c=>c.flag===flag);
  const rid = rnd(['common','common','common','uncommon','rare','epic']);
  const res = cData.gen(rid);
  return renderRealPlate(res.plate, flag, 'lg');
}

export const AUTOSELL_ORDER = {off:-1, common:0, upToUncommon:1, upToRare:2};

export function shouldAutoSell(rarity){ const lvl = AUTOSELL_ORDER[S.autoSell]; if(lvl < 0) return false; return RARITY_ORDER.indexOf(rarity) <= lvl; }

export function calcAutoSellPrice(num){ return Math.max(1, Math.round(hypoPrice(num.rarity, num.flag, extractRegion(num.plate, num.flag)) * 0.85)); }

export function doDrop(count){
  if(flags.spinning) return;
  if(!isFinite(count) || count < 1) count = 1;
  if(count > MAX_CUSTOM_SPIN) count = MAX_CUSTOM_SPIN;
  const totalCost = bulkCost(count);
  if(S.rub < totalCost){ notify('Недостаточно денег. Нужно '+totalCost.toLocaleString('ru-RU')+' ₽'); Sound.error(); if(S.autoSpin) stopAutoSpin(); return; }
  if(Date.now() - S.lastSpin < cooldownMs()) return;
  S.rub -= totalCost; S.totalSpent += totalCost; S.totalSpun += count;
  flags.spinning = true; Sound.drop(); haptic(10); updateDropButtons();
  const display = document.getElementById('plateDisplay'), render = document.getElementById('plateRender');
  display.classList.add('spinning'); render.innerHTML = randomSpinFrame();
  const st = setInterval(() => { render.innerHTML = randomSpinFrame(); }, 90);
  setTimeout(() => {
    clearInterval(st);
    display.classList.remove('spinning');
    const results = [];
    let autoSoldSum = 0, autoSoldCount = 0;
    const newHistory = [];
    for(let i=0;i<count;i++){
      const num = generateNumber(false);
      S.rarityCount[num.rarity] = (S.rarityCount[num.rarity]||0) + 1;
      newHistory.push({ plate:num.plate, flag:num.flag, rarity:num.rarity, price:num.price, id:num.id, country:num.country });
      if(shouldAutoSell(num.rarity)){
        const sp = calcAutoSellPrice(num);
        S.rub += sp; S.totalEarned += sp; autoSoldSum += sp; autoSoldCount++;
      } else S.col.push(num);
      if(!S.bestNum || num.price > S.bestNum.price) S.bestNum = num;
      results.push(num);
    }
    S.history = newHistory.reverse().concat(S.history);
    if(S.history.length > HISTORY_MAX) S.history.length = HISTORY_MAX;
    const best = results.reduce((a,b) => a.price >= b.price ? a : b);
    render.innerHTML = renderRealPlate(best.plate, best.flag, 'lg');
    display.className = 'plate-display rarity-'+best.rarity;
    if(best.rarity==='divine'){ Sound.divine(); spawnConfetti(180); flashScreen(); haptic([60,40,60,40,120,40,200]); }
    else if(best.rarity==='mythic'){ Sound.epic(); spawnConfetti(140); haptic([50,30,80,30,150]); }
    else if(best.rarity==='legendary'){ Sound.epic(); spawnConfetti(110); haptic([40,30,90]); }
    else if(best.rarity==='epic'){ Sound.rare(); spawnConfetti(70); haptic([25,20,60]); }
    else if(best.rarity==='rare'){ Sound.rare(); haptic(20); }
    if(count > 1) showDropResults(results); else hideDropResults();
    updateBalances(); renderCollection(); updateStats(); updateAchievements(); updateRarityStats(); renderHistory(); save();
    const R = RMAP[best.rarity];
    let msg = count === 1 ? 'Дроп: ' + best.plate + ' · ' + R.name : 'Дроп ×' + count + ': лучший ' + best.plate + ' · ' + R.name;
    if(autoSoldCount > 0) msg += ' · авто ' + autoSoldCount + ' за ' + autoSoldSum.toLocaleString('ru-RU') + ' ₽';
    notify(msg);
    S.lastSpin = Date.now();
    flags.spinning = false;
    updateDropButtons(); updateCd();
  }, 700);
}

export function showDropResults(numbers){
  const panel = document.getElementById('dropResults');
  const grid = document.getElementById('dropResultsGrid');
  const summary = document.getElementById('dropResultsSummary');
  const title = document.getElementById('dropResultsTitle');
  const total = numbers.length;
  const sorted = [...numbers].sort((a,b) => b.price - a.price);
  const byRarity = {};
  numbers.forEach(n => { byRarity[n.rarity] = (byRarity[n.rarity]||0)+1; });
  const totalValue = numbers.reduce((s,n)=>s+n.price,0);
  title.textContent = 'Результаты ×'+total;
  const rarityText = [];
  RARITY_ORDER.slice().reverse().forEach(r => { if(byRarity[r]) rarityText.push(byRarity[r]+' × '+RMAP[r].name); });
  let html = '';
  if(total > 30){
    const top = sorted.slice(0, 12);
    html += '<div style="grid-column:1/-1;padding:14px 18px;background:var(--bg-secondary);border-radius:14px">'+
      '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Всего</span><b>'+total+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Сумма гипот.</span><b style="color:var(--green)">'+totalValue.toLocaleString('ru-RU')+' ₽</b></div></div>';
    html += top.map(n => '<div class="drcard '+n.rarity+'">'+renderRealPlate(n.plate, n.flag, '')+'<div class="drrow"><span class="rar '+n.rarity+'">'+RMAP[n.rarity].name+'</span></div><div class="drrow"><span class="price">'+n.price.toLocaleString('ru-RU')+' ₽</span></div></div>').join('');
    summary.textContent = 'Топ-12 из '+total+' · '+totalValue.toLocaleString('ru-RU')+' ₽';
  } else {
    html = sorted.map(n => '<div class="drcard '+n.rarity+'">'+renderRealPlate(n.plate, n.flag, '')+'<div class="drrow"><span class="rar '+n.rarity+'">'+RMAP[n.rarity].name+'</span></div><div class="drrow"><span class="price">'+n.price.toLocaleString('ru-RU')+' ₽</span></div></div>').join('');
    summary.textContent = rarityText.join(' · ') + ' · ' + totalValue.toLocaleString('ru-RU')+' ₽';
  }
  grid.innerHTML = html;
  panel.style.display = 'block';
  if(window._dhT) clearTimeout(window._dhT);
  window._dhT = setTimeout(() => { panel.style.display = 'none'; }, total > 30 ? 60000 : 25000);
}

export function hideDropResults(){
  const panel = document.getElementById('dropResults');
  if(panel) panel.style.display = 'none';
  if(window._dhT) clearTimeout(window._dhT);
}
