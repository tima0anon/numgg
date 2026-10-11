import {
  HISTORY_MAX,
  KEY,
  MAX_CUSTOM_SPIN,
  START_RUB,
} from '../config/constants.js';
import { market } from '../state/market.js';
import { S } from '../state/player.js';

// SAVE/LOAD
export function save(){
  try {
    const data = {
      rub: S.rub, col: S.col, cdLvl: S.cdLvl, luckLvl: S.luckLvl, autoLvl: S.autoLvl,
      nextId: S.nextId, totalSpun: S.totalSpun, totalSpent: S.totalSpent, totalEarned: S.totalEarned,
      bestNum: S.bestNum, selectedCountry: S.selectedCountry, autoSpin: S.autoSpin, autoSell: S.autoSell,
      history: S.history, rarityCount: S.rarityCount, customSpinN: S.customSpinN,
      earnSolved: S.earnSolved, earnWrong: S.earnWrong, earnStreak: S.earnStreak, earnBest: S.earnBest,
      coefLow: S.coefLow, coefHigh: S.coefHigh, news: S.news, acct: S.acct,
      myListings: market.listings.map(l => ({ numId: l.numId, price: l.price, sessions: l.sessions, kind: l.kind }))
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch(e){}
}

export function load(){
  try {
    const raw = localStorage.getItem(KEY);
    if(!raw) return;
    const p = JSON.parse(raw);
    S.rub = (typeof p.rub==='number' && p.rub>=0) ? p.rub : START_RUB;
    S.col = Array.isArray(p.col) ? p.col.map(n => Object.assign({},n,{favorite:!!n.favorite, listed:!!n.listed})) : [];
    S.cdLvl = p.cdLvl || 0; S.luckLvl = p.luckLvl || 0; S.autoLvl = p.autoLvl || 0;
    S.nextId = p.nextId || 1;
    S.totalSpun = p.totalSpun || 0; S.totalSpent = p.totalSpent || 0; S.totalEarned = p.totalEarned || 0;
    S.bestNum = p.bestNum || null;
    S.selectedCountry = (p.selectedCountry && ['all','ru','by','cn','us','ua'].includes(p.selectedCountry)) ? p.selectedCountry : 'all';
    S.autoSpin = !!p.autoSpin;
    S.autoSell = ['off','common','upToUncommon','upToRare'].includes(p.autoSell) ? p.autoSell : 'off';
    S.history = Array.isArray(p.history) ? p.history.slice(0, HISTORY_MAX) : [];
    S.rarityCount = Object.assign({common:0,uncommon:0,rare:0,epic:0,legendary:0,mythic:0,divine:0}, p.rarityCount || {});
    S.customSpinN = (typeof p.customSpinN==='number' && p.customSpinN>=1 && p.customSpinN<=MAX_CUSTOM_SPIN) ? p.customSpinN : 25;
    S.earnSolved = p.earnSolved||0; S.earnWrong = p.earnWrong||0; S.earnStreak = p.earnStreak||0; S.earnBest = p.earnBest||0;
    S.coefLow = (typeof p.coefLow==='number' && p.coefLow>=1 && p.coefLow<=90) ? p.coefLow : 20;
    S.coefHigh = (typeof p.coefHigh==='number' && p.coefHigh>=1 && p.coefHigh<=200) ? p.coefHigh : 20;
    S.news = Array.isArray(p.news) ? p.news.filter(n => n.until > Date.now()) : [];
    if(p.acct && typeof p.acct==='object'){ Object.assign(S.acct, p.acct); if(!Array.isArray(S.acct.log)) S.acct.log = []; }
    // Restore myListings
    if(Array.isArray(p.myListings)){
      market.listings = p.myListings
        .filter(l => l && S.col.find(n => n.id === l.numId))
        .map(l => ({ numId: l.numId, price: l.price||0, sessions: l.sessions||0, kind: l.kind||'mid' }));
      // Sync listed flags
      const listedIds = new Set(market.listings.map(l => l.numId));
      S.col.forEach(n => { n.listed = listedIds.has(n.id); });
    }
  } catch(e){}
}
