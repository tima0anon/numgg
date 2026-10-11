import {
  MAX_CUSTOM_SPIN,
  NEWS_CHECK_INTERVAL,
  PAGE_KEY,
  SECRET_CODE,
  SECRET_FULL_CODE,
  TICK_MS,
} from '../config/constants.js';
import { COUNTRIES } from '../domain/plates/countries.js';
import {
  renderAcctLog,
  runAccountantSession,
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
} from '../features/exchange/view.js';
import { renderCollection } from '../features/garage/view.js';
import { updateBalances } from '../features/hud/balance.js';
import {
  renderHistory,
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../features/hud/stats.js';
import {
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
  triggerCustomSpin,
  triggerEasterEgg,
  triggerFullCollection,
} from '../features/shell/secrets.js';
import { Sound } from '../services/audio.js';
import { notify } from '../services/notify.js';
import {
  load,
  save,
} from '../services/storage.js';
import { flags } from '../state/flags.js';
import { market } from '../state/market.js';
import { S } from '../state/player.js';

export function init(){
  load();
  document.querySelectorAll('.topnav-btn').forEach(b => b.addEventListener('click', () => { Sound.click(); switchPage(b.dataset.page); }));
  let savedPage = 'drop';
  try { savedPage = localStorage.getItem(PAGE_KEY) || 'drop'; } catch(e){}
  if(!['drop','earn','exchange','garage','accountant','news','info'].includes(savedPage)) savedPage = 'drop';
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
    cs.addEventListener('input', () => {
      const raw = parseInt(cs.value, 10);
      if(raw === SECRET_CODE){ triggerEasterEgg(); return; }
      if(raw === SECRET_FULL_CODE){ triggerFullCollection(); return; }
      updateDropCostsUI();
    });
    cs.addEventListener('change', () => {
      let n = parseInt(cs.value, 10);
      if(n === SECRET_CODE){ triggerEasterEgg(); return; }
      if(n === SECRET_FULL_CODE){ triggerFullCollection(); return; }
      if(!isFinite(n) || n < 1) n = 1;
      if(n > MAX_CUSTOM_SPIN) n = MAX_CUSTOM_SPIN;
      cs.value = n; S.customSpinN = n; save(); updateDropCostsUI();
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

  const cl = document.getElementById('coefLow');
  const ch = document.getElementById('coefHigh');
  cl.value = S.coefLow; ch.value = S.coefHigh;
  cl.addEventListener('change', () => { let v = parseInt(cl.value,10); if(!isFinite(v)) v = 20; v = Math.max(1, Math.min(90, v)); S.coefLow = v; cl.value = v; save(); renderCollection(); });
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

  document.querySelectorAll('.ex-tab').forEach(t => t.addEventListener('click', () => {
    Sound.click();
    document.querySelectorAll('.ex-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.ex-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('excontent-'+t.dataset.extab).classList.add('active');
  }));

  const oSort = document.getElementById('exOfferSort');
  const oCountry = document.getElementById('exOfferCountry');
  const oRarity = document.getElementById('exOfferRarity');
  const oSearch = document.getElementById('exOfferSearch');
  oSort.value = market.filters.oSort;
  oCountry.value = market.filters.oCountry;
  oRarity.value = market.filters.oRarity;
  oSort.addEventListener('change', () => { market.filters.oSort = oSort.value; renderOffers(); });
  oCountry.addEventListener('change', () => { market.filters.oCountry = oCountry.value; renderOffers(); });
  oRarity.addEventListener('change', () => { market.filters.oRarity = oRarity.value; renderOffers(); });
  oSearch.addEventListener('input', () => { market.filters.oSearch = oSearch.value; renderOffers(); });
  document.getElementById('exOfferReset').addEventListener('click', () => {
    market.filters.oSort = 'dev-asc'; market.filters.oCountry = 'all'; market.filters.oRarity = 'all'; market.filters.oSearch = '';
    oSort.value = 'dev-asc'; oCountry.value = 'all'; oRarity.value = 'all'; oSearch.value = '';
    renderOffers();
  });

  const ordSort = document.getElementById('exOrderSort');
  const ordCountry = document.getElementById('exOrderCountry');
  ordSort.value = market.filters.ordSort;
  ordCountry.value = market.filters.ordCountry;
  ordSort.addEventListener('change', () => { market.filters.ordSort = ordSort.value; renderOrders(); });
  ordCountry.addEventListener('change', () => { market.filters.ordCountry = ordCountry.value; renderOrders(); });
  document.getElementById('exOrderReset').addEventListener('click', () => {
    market.filters.ordSort = 'reward-desc'; market.filters.ordCountry = 'all';
    ordSort.value = 'reward-desc'; ordCountry.value = 'all';
    renderOrders();
  });
  const offerCountryOptions = '<option value="all">Все страны</option>' + COUNTRIES.map(c => '<option value="'+c.id+'">'+c.name+'</option>').join('');
  oCountry.innerHTML = offerCountryOptions;
  ordCountry.innerHTML = offerCountryOptions;

  document.querySelectorAll('#acctMode button').forEach(b => b.addEventListener('click', () => {
    S.acct.mode = b.dataset.mode;
    Sound.click();
    updateAcctUI(); save();
    notify('Бухгалтер: '+({off:'выключен',notify:'уведомления',auto:'авто'})[b.dataset.mode]);
    if(S.acct.mode !== 'off') runAccountantSession();
    renderExchange();
  }));
  document.getElementById('buyAcctSpeed').addEventListener('click', () => buyAcctSkill('speed'));
  document.getElementById('buyAcctAccuracy').addEventListener('click', () => buyAcctSkill('accuracy'));
  document.getElementById('buyAcctRisk').addEventListener('click', () => buyAcctSkill('risk'));
  document.getElementById('acctThMinus').addEventListener('click', () => { S.acct.threshold = Math.max(5, S.acct.threshold - 5); updateAcctUI(); save(); });
  document.getElementById('acctThPlus').addEventListener('click', () => { S.acct.threshold = Math.min(90, S.acct.threshold + 5); updateAcctUI(); save(); });
  document.getElementById('acctAutoBuyToggle').addEventListener('click', () => { S.acct.autoBuy = !S.acct.autoBuy; Sound.click(); updateAcctUI(); save(); });
  document.getElementById('acctAutoSellToggle').addEventListener('click', () => { S.acct.autoSell = !S.acct.autoSell; Sound.click(); updateAcctUI(); save(); });

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    Sound.click();
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-'+t.dataset.tab).classList.add('active');
    if(t.dataset.tab === 'stats') updateRarityStats();
    if(t.dataset.tab === 'wealth') renderWealthTable();
  }));

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
    else if(e.key >= '1' && e.key <= '7'){
      const pages = ['drop','earn','exchange','garage','accountant','news','info'];
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
  // News generation: every 40s check (slow, max 3 active)
  setInterval(generateNews, NEWS_CHECK_INTERVAL);
  // New news items get added only via generateNews; renderNews is incremental
}
