import { DAILY_KEY, HISTORY_MAX, KEY, MAX_CUSTOM_SPIN, SALE_ROLL_MS, START_RUB } from '../config/constants.js';
import { queueScore } from './remote.js';
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
      earnLevel: S.earnLevel, usedPromos: S.usedPromos, testAdmin: S.testAdmin,
      upgraderPending: S.upgraderPending, upgraderLog: S.upgraderLog, upgraderStats: S.upgraderStats,
      playerName: S.playerName, peakRub: S.peakRub, rivals: S.rivals, epoch: S.epoch || 0, forceId: S.forceId || '',
      myListings: market.listings.map(l => ({ numId: l.numId, price: l.price, sessions: l.sessions, kind: l.kind, listedAt: l.listedAt, nextRollAt: l.nextRollAt }))
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    queueScore(Math.max(S.rub, S.peakRub || 0), S.epoch || 0, S.forceId || '');
  } catch(e){}
}

export function storedEpoch(){
  try {
    const raw = localStorage.getItem(KEY);
    if(!raw) return 0;
    const epoch = JSON.parse(raw).epoch;
    return typeof epoch === 'number' && epoch >= 0 ? epoch : 0;
  } catch {
    return 0;
  }
}

export function dropSaveForSeason(epoch){
  if((epoch || 0) > storedEpoch()){
    localStorage.removeItem(KEY);
    localStorage.removeItem(DAILY_KEY);
  }
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
    S.earnLevel = [0,1,2,3].includes(p.earnLevel) ? p.earnLevel : 0;
    S.usedPromos = Array.isArray(p.usedPromos) ? p.usedPromos.filter(code => typeof code === 'string').slice(0, 8) : [];
    S.testAdmin = !!p.testAdmin;
    S.upgraderLog = Array.isArray(p.upgraderLog) ? p.upgraderLog.filter(row => row && typeof row.plate === 'string').slice(0, 12) : [];
    S.upgraderStats = {
      spins: p.upgraderStats && p.upgraderStats.spins > 0 ? Math.floor(p.upgraderStats.spins) : 0,
      wins: p.upgraderStats && p.upgraderStats.wins > 0 ? Math.floor(p.upgraderStats.wins) : 0,
    };
    const pending = p.upgraderPending;
    S.upgraderPending = pending && pending.target && typeof pending.target.plate === 'string' && typeof pending.chance === 'number'
      ? pending
      : null;
    S.coefLow = (typeof p.coefLow==='number' && p.coefLow>=10 && p.coefLow<=90) ? p.coefLow : 20;
    S.coefHigh = (typeof p.coefHigh==='number' && p.coefHigh>=1 && p.coefHigh<=200) ? p.coefHigh : 20;
    S.news = Array.isArray(p.news) ? p.news.filter(n => n.until > Date.now()) : [];
    if(p.acct && typeof p.acct==='object'){ Object.assign(S.acct, p.acct); if(!Array.isArray(S.acct.log)) S.acct.log = []; }
    S.playerName = typeof p.playerName === 'string' ? p.playerName.slice(0, 16) : '';
    S.peakRub = (typeof p.peakRub === 'number' && p.peakRub >= 0) ? Math.max(p.peakRub, S.rub) : S.rub;
    S.epoch = (typeof p.epoch === 'number' && p.epoch >= 0) ? p.epoch : 0;
    S.forceId = typeof p.forceId === 'string' ? p.forceId : '';
    S.rivals = Array.isArray(p.rivals) ? p.rivals.filter(r => r && typeof r.name === 'string' && typeof r.rub === 'number' && r.rub >= 0).slice(0, 40) : [];
    // Restore myListings
    if(Array.isArray(p.myListings)){
      market.listings = p.myListings
        .filter(l => l && S.col.find(n => n.id === l.numId))
        .map(l => ({
          numId: l.numId,
          price: l.price||0,
          sessions: l.sessions||0,
          kind: l.kind||'mid',
          listedAt: l.listedAt || Date.now(),
          nextRollAt: l.nextRollAt || (Date.now() + SALE_ROLL_MS)
        }));
      // Sync listed flags
      const listedIds = new Set(market.listings.map(l => l.numId));
      S.col.forEach(n => { n.listed = listedIds.has(n.id); });
    }
  } catch(e){}
}
