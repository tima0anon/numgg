import { START_RUB, UPGRADE_MAX } from '../../config/constants.js';
import {
  isRecentPlate,
  rememberPlate,
} from '../../domain/memory.js';
import {
  COUNTRIES,
  extractRegion,
} from '../../domain/plates/countries.js';
import { hypoPrice } from '../../domain/pricing.js';
import { updateAcctUI } from '../accountant/view.js';
import { generateExchangeSession } from '../exchange/session.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';
import {
  updateAchievements,
  updateRarityStats,
  updateStats,
} from '../hud/stats.js';
import { injectNews } from '../news/feed.js';
import { startAuto } from '../progress/upgrades.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';

function refresh(){
  updateBalances();
  renderCollection();
  updateStats();
  updateAchievements();
  updateRarityStats();
  updateAcctUI();
  paintTestBench();
  save();
}

export function paintTestBench(){
  const status = document.getElementById('testStatus');
  if(!status) return;
  const used = Array.isArray(S.usedPromos) && S.usedPromos.length ? S.usedPromos.join(', ') : 'нет';
  status.textContent = 'Баланс ' + Math.round(S.rub).toLocaleString('ru-RU') + ' ₽ · номеров ' + S.col.length + ' · промокоды: ' + used;
  const input = document.getElementById('testBalance');
  if(input && document.activeElement !== input) input.value = String(Math.round(S.rub));
}

function givePlate(){
  const countryId = document.getElementById('testCountry')?.value || 'ru';
  const rarity = document.getElementById('testRarity')?.value || 'common';
  const country = COUNTRIES.find(row => row.id === countryId);
  if(!country) return;
  let res;
  let tries = 0;
  do { res = country.gen(rarity); tries++; } while(isRecentPlate(res.plate, country.flag) && tries < 40);
  rememberPlate(res.plate, country.flag);
  const region = extractRegion(res.plate, country.flag);
  const price = hypoPrice(rarity, country.flag, region, res.plate);
  const item = {
    id: S.nextId++,
    country: country.name,
    flag: country.flag,
    plate: res.plate,
    rarity,
    price,
    region,
    bought: 0,
    favorite: false,
  };
  S.col.push(item);
  S.rarityCount[rarity] = (S.rarityCount[rarity] || 0) + 1;
  if(!S.bestNum || item.price > S.bestNum.price) S.bestNum = item;
  Sound.buy();
  notify('Выдан ' + item.plate);
  refresh();
}

function clearGarage(){
  if(!confirm('Убрать все номера из гаража и снять лоты?')) return;
  S.col = [];
  market.listings = [];
  S.bestNum = null;
  Sound.click();
  notify('Гараж пуст');
  refresh();
}

export function bindTestBench(){
  document.getElementById('testSetBalance')?.addEventListener('click', () => {
    const value = Math.round(Number(document.getElementById('testBalance')?.value));
    if(!isFinite(value) || value < 0){ notify('Нужно число от нуля'); Sound.error(); return; }
    S.rub = value;
    if(value > S.peakRub) S.peakRub = value;
    Sound.click();
    notify('Баланс ' + value.toLocaleString('ru-RU') + ' ₽');
    refresh();
  });
  document.getElementById('testPlus')?.addEventListener('click', () => {
    S.rub += 1000000;
    if(S.rub > S.peakRub) S.peakRub = S.rub;
    Sound.coin();
    refresh();
  });
  document.getElementById('testStart')?.addEventListener('click', () => {
    S.rub = START_RUB;
    Sound.click();
    refresh();
  });
  document.getElementById('testGive')?.addEventListener('click', givePlate);
  document.getElementById('testMax')?.addEventListener('click', () => {
    S.cdLvl = UPGRADE_MAX;
    S.luckLvl = UPGRADE_MAX;
    S.autoLvl = UPGRADE_MAX;
    startAuto();
    Sound.buy();
    notify('Улучшения на максимуме');
    refresh();
  });
  document.getElementById('testAcct')?.addEventListener('click', () => {
    S.acct.hired = true;
    S.acct.autoPaid = true;
    S.acct.mode = 'auto';
    S.acct.speed = 8;
    S.acct.accuracy = 8;
    S.acct.risk = 4;
    Sound.click();
    notify('Бухгалтер нанят, авто включено');
    refresh();
  });
  document.getElementById('testBull')?.addEventListener('click', () => { injectNews('bull'); Sound.click(); notify('Хорошая новость на ленте'); });
  document.getElementById('testBear')?.addEventListener('click', () => { injectNews('bear'); Sound.click(); notify('Плохая новость на ленте'); });
  document.getElementById('testBoard')?.addEventListener('click', () => { generateExchangeSession(); Sound.click(); notify('Биржа обновлена'); });
  document.getElementById('testPromos')?.addEventListener('click', () => {
    S.usedPromos = [];
    Sound.click();
    notify('Промокоды снова можно ввести');
    refresh();
  });
  document.getElementById('testClear')?.addEventListener('click', clearGarage);
}
