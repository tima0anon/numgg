import {
  DAILY_KEY,
  KEY,
  START_RUB,
} from '../../config/constants.js';
import { recentPlates } from '../../domain/memory.js';
import { renderAcctLog } from '../accountant/session.js';
import { updateAcctUI } from '../accountant/view.js';
import {
  updateAutoSellUI,
  updateAutoSpinUI,
} from '../drop/autospin.js';
import {
  applyCountryPreview,
  syncCountryPickerUI,
} from '../drop/country.js';
import { hideDropResults } from '../drop/spin.js';
import { renderEarnProblem } from '../earn/math.js';
import { generateExchangeSession } from '../exchange/session.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';
import {
  renderHistory,
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../hud/stats.js';
import { renderNews } from '../news/feed.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

export function resetProgress(silent){
  if(!silent && !confirm('Сбросить весь прогресс?')) return;
  localStorage.removeItem(KEY); localStorage.removeItem(DAILY_KEY);
  S.rub = START_RUB; S.col = [];
  S.cdLvl = 0; S.luckLvl = 0; S.autoLvl = 0;
  S.nextId = 1; S.lastSpin = 0;
  S.totalSpun = 0; S.totalSpent = 0; S.totalEarned = 0;
  S.bestNum = null; S.selectedCountry = 'all'; S.autoSpin = false; S.autoSell = 'off';
  S.history = []; S.rarityCount = {common:0,uncommon:0,rare:0,epic:0,legendary:0,mythic:0,divine:0};
  S.customSpinN = 25; S.earnSolved = 0; S.earnWrong = 0; S.earnStreak = 0; S.earnBest = 0; S.earnLevel = 0;
  S.usedCashCode = false;
  S.coefLow = 20; S.coefHigh = 20; S.news = [];
  S.peakRub = START_RUB;
  S.acct = { mode:'off', hired:false, autoPaid:false, speed:0, accuracy:0, risk:0, threshold:15, autoBuy:false, autoSell:false, analyzed:0, found:0, deals:0, profit:0, log:[] };
  flags.lastWealthIdx = -1; flags.lastShownRub = null; recentPlates.length = 0;
  market.offers = []; market.orders = []; market.listings = [];
  if(flags.autoTimer) clearInterval(flags.autoTimer);
  if(flags.autoSpinTimer){ clearInterval(flags.autoSpinTimer); flags.autoSpinTimer = null; }
  hideDropResults();
  const cs = document.getElementById('customSpinCount'); if(cs) cs.value = 25;
  document.getElementById('coefLow').value = 20;
  document.getElementById('coefHigh').value = 20;
  updateBalances(); renderCollection(); updateStats(); updateAchievements(); updateRarityStats(); renderHistory(); updateAcctUI(); renderAcctLog();
  save();
  syncCountryPickerUI(); applyCountryPreview(); updateAutoSpinUI(); updateAutoSellUI(); renderEarnProblem();
  renderNews();
  generateExchangeSession();
  notify('Игра начата заново');
}
