import { START_RUB } from '../config/constants.js';

// STATE
export const S = {
  rub: START_RUB, col: [],
  cdLvl: 0, luckLvl: 0, autoLvl: 0,
  lastSpin: 0, nextId: 1,
  totalSpun: 0, totalSpent: 0, totalEarned: 0,
  bestNum: null, selectedCountry: 'all',
  autoSpin: false, autoSell: 'off', history: [],
  rarityCount: {common:0,uncommon:0,rare:0,epic:0,legendary:0,mythic:0,divine:0},
  customSpinN: 25, earnSolved: 0, earnWrong: 0, earnStreak: 0, earnBest: 0,
  coefLow: 20, coefHigh: 20, news: [],
  acct: { mode:'off', speed:0, accuracy:0, risk:0, threshold:15, autoBuy:false, autoSell:false, analyzed:0, found:0, deals:0, profit:0, log:[] }
};
