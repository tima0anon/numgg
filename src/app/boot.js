import {
  MAX_CUSTOM_SPIN,
  NEWS_CHECK_INTERVAL,
  PAGE_KEY,
  KEY,
  ACCT_AUTO_COST,
  ACCT_HIRE_COST,
  SOCIAL_PAUSED,
  TICK_MS,
} from '../config/constants.js';
import { COUNTRIES } from '../domain/plates/countries.js';
import {
  renderAcctLog,
  runAccountantSession,
  takeAdvice,
} from '../features/accountant/session.js';
import {
  buyAcctSkill,
  updateAcctUI,
} from '../features/accountant/view.js';
import {
  startAutoSpinTimer,
  toggleAutoSpin,
  updateAutoSellUI,
  updateAutoSpinUI,
} from '../features/drop/autospin.js';
import {
  applyCountryPreview,
  selectCountry,
  syncCountryPickerUI,
} from '../features/drop/country.js';
import {
  doDrop,
  hideDropResults,
  updateCd,
  updateDropCostsUI,
} from '../features/drop/spin.js';
import {
  renderEarnProblem,
  submitEarnAnswer,
  updateEarnStats,
} from '../features/earn/math.js';
import {
  generateExchangeSession,
  tickExchange,
  updateSessionCountdown,
} from '../features/exchange/session.js';
import {
  renderExchange,
  renderOffers,
  renderOrders,
  unlistAll,
} from '../features/exchange/view.js';
import { sellBulk } from '../features/garage/sell.js';
import { renderCollection } from '../features/garage/view.js';
import { settleUpgrader } from '../features/upgrader/roll.js';
import { bindUpgrader } from '../features/upgrader/view.js';
import { bindTestBench } from '../features/admin/bench.js';
import { bindAdmin } from '../features/admin/panel.js';
import { ensureSession } from '../features/auth/gate.js';
import { applyServer, startProfileSync } from '../features/auth/live.js';
import { bindRankAccount } from '../features/rank/account.js';
import { renderRank } from '../features/rank/board.js';
import { updateBalances } from '../features/hud/balance.js';
import {
  renderHistory,
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../features/hud/stats.js';
import {
  renderEconomyInfo,
  renderFormatsTab,
  renderWealthTable,
} from '../features/info/panels.js';
import {
  generateNews,
  renderNews,
  updateNewsTimers,
} from '../features/news/feed.js';
import {
  claimDaily,
  updateDailyUI,
} from '../features/progress/daily.js';
import {
  buyAuto,
  buyCd,
  buyLuck,
  startAuto,
} from '../features/progress/upgrades.js';
import {
  switchPage,
  toggleSound,
  toggleTheme,
  updateSoundUI,
} from '../features/shell/chrome.js';
import { resetProgress } from '../features/shell/reset.js';
import {
  isSpinCode,
  previewSpinField,
  syncAdminNav,
  triggerCustomSpin,
} from '../features/shell/secrets.js';
import { Sound } from '../services/audio.js';
import { notify } from '../services/notify.js';
import {
  dropSaveForSeason,
  load,
  save,
} from '../services/storage.js';
import { flags } from '../state/flags.js';
import { market } from '../state/market.js';
import { S } from '../state/player.js';

export async function init(){
  let me = null;
  if(!SOCIAL_PAUSED){
    me = await ensureSession();
    if(me) dropSaveForSeason(me.epoch || 0);
    if(me && me.save && typeof me.save === 'object' && (me.save.epoch || 0) >= (me.epoch || 0)){
      try { localStorage.setItem(KEY, JSON.stringify(me.save)); } catch(e){}
    }
  }
  const gate = document.getElementById('authGate');
  if(SOCIAL_PAUSED && gate) gate.hidden = true;
  load();
  const settledUp = settleUpgrader();
  if(settledUp) notify(settledUp.win ? 'Апргейдербета докрутила: ' + settledUp.target.plate : 'Апргейдербета докрутила мимо');
  if(me && (me.epoch || 0) > (S.epoch || 0)) S.epoch = me.epoch;
  if(me && me.nick) S.playerName = me.nick;
  if(!SOCIAL_PAUSED) startProfileSync();
  syncAdminNav();
  const rankNav = document.querySelector('.topnav-btn[data-page="rank"]');
  if(rankNav) rankNav.hidden = SOCIAL_PAUSED;
  document.querySelectorAll('.topnav-btn').forEach(b => b.addEventListener('click', () => { Sound.click(); switchPage(b.dataset.page); }));
  let savedPage = 'drop';
  try { savedPage = localStorage.getItem(PAGE_KEY) || 'drop'; } catch(e){}
  if(!['drop','earn','exchange','garage','upgrader','accountant','news','rank','info','admin'].includes(savedPage)) savedPage = 'drop';
  if(savedPage === 'rank' && SOCIAL_PAUSED) savedPage = 'drop';
  switchPage(savedPage);

  document.querySelectorAll('#countryPicker .cpill').forEach(b => b.addEventListener('click', () => selectCountry(b.dataset.country)));
  syncCountryPickerUI(); applyCountryPreview();

  document.getElementById('spin1').addEventListener('click', () => doDrop(1));
  document.getElementById('spin5').addEventListener('click', () => doDrop(5));
  document.getElementById('spin10').addEventListener('click', () => doDrop(10));
  document.getElementById('closeResults').addEventListener('click', hideDropResults);
  const cs = document.getElementById('customSpinCount');
  if(cs){
    cs.value = S.customSpinN || 25;
    cs.addEventListener('input', previewSpinField);
    cs.addEventListener('change', () => {
      const raw = cs.value.trim();
      if(isSpinCode(raw) || !/^\d+$/.test(raw)) return;
      let n = parseInt(raw, 10);
      if(!isFinite(n) || n < 1) n = 1;
      if(n > MAX_CUSTOM_SPIN) n = MAX_CUSTOM_SPIN;
      cs.value = String(n); S.customSpinN = n; save(); updateDropCostsUI();
    });
    cs.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); triggerCustomSpin(); } });
  }
  document.getElementById('spinCustom').addEventListener('click', triggerCustomSpin);
  document.getElementById('autoSpinToggle').addEventListener('click', toggleAutoSpin);
  const asSelect = document.getElementById('autoSellSelect');
  asSelect.addEventListener('change', () => { S.autoSell = asSelect.value; Sound.click(); save(); });
  document.getElementById('dailyBtn').addEventListener('click', claimDaily);
  document.getElementById('buyCd').addEventListener('click', buyCd);
  document.getElementById('buyLuck').addEventListener('click', buyLuck);
  document.getElementById('buyAuto').addEventListener('click', buyAuto);
  document.getElementById('reset').addEventListener('click', resetProgress);

  document.getElementById('earnSubmit').addEventListener('click', submitEarnAnswer);
  document.getElementById('earnInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); submitEarnAnswer(); } });
  document.getElementById('earnSkip').addEventListener('click', () => { if(flags.earnLocked) return; S.earnStreak = 0; Sound.click(); updateEarnStats(); save(); renderEarnProblem(); });
  document.querySelectorAll('#earnLevel button').forEach(b => b.addEventListener('click', () => {
    S.earnLevel = Number(b.dataset.level) || 0;
    Sound.click(); save(); renderEarnProblem();
  }));

  const cl = document.getElementById('coefLow');
  const ch = document.getElementById('coefHigh');
  cl.value = S.coefLow; ch.value = S.coefHigh;
  cl.addEventListener('change', () => { let v = parseInt(cl.value,10); if(!isFinite(v)) v = 20; v = Math.max(10, Math.min(90, v)); S.coefLow = v; cl.value = v; save(); renderCollection(); });
  ch.addEventListener('change', () => { let v = parseInt(ch.value,10); if(!isFinite(v)) v = 20; v = Math.max(1, Math.min(200, v)); S.coefHigh = v; ch.value = v; save(); renderCollection(); });

  ['fCountry','fRarity','fSort','fPrice','fSearch'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', renderCollection);
    el.addEventListener('change', renderCollection);
  });
  document.getElementById('clearF').addEventListener('click', () => {
    document.getElementById('fCountry').value = 'all';
    document.getElementById('fRarity').value = 'all';
    document.getElementById('fSort').value = 'default';
    document.getElementById('fPrice').value = '';
    document.getElementById('fSearch').value = '';
    renderCollection();
  });
  document.getElementById('sellAllLow').addEventListener('click', () => sellBulk('low'));
  document.getElementById('sellAllMid').addEventListener('click', () => sellBulk('mid'));
  document.getElementById('sellAllHigh').addEventListener('click', () => sellBulk('high'));

  document.querySelectorAll('.ex-tab').forEach(t => t.addEventListener('click', () => {
    Sound.click();
    document.querySelectorAll('.ex-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.ex-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('excontent-'+t.dataset.extab).classList.add('active');
  }));

  const oCountry = document.getElementById('exOfferCountry');
  const oRarity = document.getElementById('exOfferRarity');
  const oSearch = document.getElementById('exOfferSearch');
  const offerCountryOptions = '<option value="all">Все страны</option>' + COUNTRIES.map(c => '<option value="'+c.id+'">'+c.name+'</option>').join('');
  oCountry.innerHTML = offerCountryOptions;
  oCountry.value = market.filters.oCountry;
  oRarity.value = market.filters.oRarity;
  oCountry.addEventListener('change', () => { market.filters.oCountry = oCountry.value; renderOffers(); });
  oRarity.addEventListener('change', () => { market.filters.oRarity = oRarity.value; renderOffers(); });
  oSearch.addEventListener('input', () => { market.filters.oSearch = oSearch.value; renderOffers(); });
  const oBelow = document.getElementById('exOfferBelow');
  const paintBelow = () => { if(oBelow) oBelow.classList.toggle('on', !!market.filters.oBelow); };
  paintBelow();
  oBelow?.addEventListener('click', () => {
    market.filters.oBelow = !market.filters.oBelow;
    paintBelow();
    renderOffers();
  });
  document.getElementById('exOfferReset').addEventListener('click', () => {
    market.filters.oCountry = 'all'; market.filters.oRarity = 'all'; market.filters.oSearch = '';
    market.filters.oBelow = false;
    oCountry.value = 'all'; oRarity.value = 'all'; oSearch.value = '';
    paintBelow();
    renderOffers();
  });

  const ordCountry = document.getElementById('exOrderCountry');
  ordCountry.innerHTML = offerCountryOptions;
  ordCountry.value = market.filters.ordCountry;
  ordCountry.addEventListener('change', () => { market.filters.ordCountry = ordCountry.value; renderOrders(); });
  document.getElementById('exOrderReset').addEventListener('click', () => {
    market.filters.ordCountry = 'all';
    ordCountry.value = 'all';
    renderOrders();
  });
  document.getElementById('unlistAll').addEventListener('click', unlistAll);

  document.querySelectorAll('#acctMode button').forEach(b => b.addEventListener('click', () => {
    const mode = b.dataset.mode;
    if(mode === 'notify' && !S.acct.hired){
      if(S.rub < ACCT_HIRE_COST){ notify('Чтобы нанять бухгалтера, нужно '+ACCT_HIRE_COST.toLocaleString('ru-RU')+' ₽'); Sound.error(); return; }
      S.rub -= ACCT_HIRE_COST; S.totalSpent += ACCT_HIRE_COST; S.acct.hired = true;
      notify('Бухгалтер нанят за '+ACCT_HIRE_COST.toLocaleString('ru-RU')+' ₽');
    }
    if(mode === 'auto' && !S.acct.autoPaid){
      if(!S.acct.hired){
        if(S.rub < ACCT_HIRE_COST + ACCT_AUTO_COST){ notify('Сначала найм за '+ACCT_HIRE_COST.toLocaleString('ru-RU')+' ₽, автоторговля ещё '+ACCT_AUTO_COST.toLocaleString('ru-RU')+' ₽'); Sound.error(); return; }
        S.rub -= ACCT_HIRE_COST; S.totalSpent += ACCT_HIRE_COST; S.acct.hired = true;
      } else if(S.rub < ACCT_AUTO_COST){ notify('Автоторговля стоит '+ACCT_AUTO_COST.toLocaleString('ru-RU')+' ₽'); Sound.error(); return; }
      S.rub -= ACCT_AUTO_COST; S.totalSpent += ACCT_AUTO_COST; S.acct.autoPaid = true;
      notify('Автоторговля открыта за '+ACCT_AUTO_COST.toLocaleString('ru-RU')+' ₽');
    }
    S.acct.mode = mode;
    Sound.click();
    updateBalances();
    updateAcctUI(); save();
    if(mode === 'off' || S.acct.hired) notify('Бухгалтер: '+({off:'выключен',notify:'подсказки',auto:'сам торгует'})[mode]);
    if(S.acct.mode !== 'off') runAccountantSession();
    renderExchange();
  }));
  document.getElementById('buyAcctSpeed').addEventListener('click', () => buyAcctSkill('speed'));
  document.getElementById('buyAcctAccuracy').addEventListener('click', () => buyAcctSkill('accuracy'));
  document.getElementById('buyAcctRisk').addEventListener('click', () => buyAcctSkill('risk'));
  document.getElementById('acctThMinus').addEventListener('click', () => { S.acct.threshold = Math.max(5, S.acct.threshold - 5); updateAcctUI(); save(); });
  document.getElementById('acctThPlus').addEventListener('click', () => { S.acct.threshold = Math.min(90, S.acct.threshold + 5); updateAcctUI(); save(); });
  document.getElementById('acctAdvice').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if(!btn) return;
    takeAdvice(btn.dataset.kind, btn.dataset.id, btn.dataset.num);
  });

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    Sound.click();
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-'+t.dataset.tab).classList.add('active');
    if(t.dataset.tab === 'stats') updateRarityStats();
    if(t.dataset.tab === 'wealth') renderWealthTable();
  }));

  if(!SOCIAL_PAUSED) bindRankAccount();
  bindAdmin();
  bindTestBench();
  bindUpgrader();
  setInterval(() => {
    if(document.getElementById('page-rank')?.classList.contains('active')) renderRank();
  }, 20000);

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('soundToggle').addEventListener('click', toggleSound);
  updateSoundUI();

  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if(e.key === ' '){
      e.preventDefault();
      const page = document.querySelector('.topnav-btn.active')?.dataset.page;
      if(page === 'drop' && !flags.spinning) doDrop(1);
    } else if(e.key === 'Escape'){ hideDropResults(); }
    else if(e.key === '9'){ Sound.click(); switchPage('upgrader'); }
    else if(e.key >= '1' && e.key <= '8'){
      const pages = ['drop','earn','exchange','garage','accountant','news','rank','info'];
      const idx = parseInt(e.key,10) - 1;
      if(pages[idx]){ Sound.click(); switchPage(pages[idx]); }
    }
  });

  startAuto();
  if(S.autoSpin) startAutoSpinTimer();

  updateBalances();
  renderCollection();
  updateStats();
  updateAchievements();
  updateRarityStats();
  renderHistory();
  renderWealthTable();
  updateAutoSpinUI();
  updateAutoSellUI();
  updateCd();
  updateDropCostsUI();
  renderFormatsTab();
  renderEconomyInfo();
  renderEarnProblem();
  updateDailyUI();
  updateAcctUI();
  renderAcctLog();

  generateNews();
  generateExchangeSession();
  renderNews();

  // Timers — clean and separate
  if(!market.tickTimer) market.tickTimer = setInterval(tickExchange, TICK_MS);
  setInterval(updateCd, 100);
  setInterval(updateDailyUI, 1000);
  setInterval(updateSessionCountdown, 200);
  // News: only timer updates every 1s (no rebuild, no blink)
  setInterval(() => { if(document.getElementById('page-news').classList.contains('active')) updateNewsTimers(); }, 1000);
  if(!SOCIAL_PAUSED && me) applyServer(me);
  save();
  // News generation: every 40s check (slow, max 3 active)
  setInterval(generateNews, NEWS_CHECK_INTERVAL);
  // New news items get added only via generateNews; renderNews is incremental
}
