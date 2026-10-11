import {
  RARITY_ORDER,
  RMAP,
} from '../../config/rarity.js';
import { Sound } from '../../services/audio.js';
import { copyText } from '../../services/clipboard.js';
import { notify } from '../../services/notify.js';
import { S } from '../../state/player.js';

export function updateStats(){
  document.getElementById('stTotal').textContent = S.totalSpun;
  document.getElementById('stSpent').textContent = S.totalSpent.toLocaleString('ru-RU')+' ₽';
  document.getElementById('stEarned').textContent = S.totalEarned.toLocaleString('ru-RU')+' ₽';
  document.getElementById('stBest').textContent = S.bestNum ? S.bestNum.price.toLocaleString('ru-RU')+' ₽' : '—';
  document.getElementById('stRare').textContent = S.col.filter(n => ['epic','legendary','mythic','divine'].includes(n.rarity)).length;
  document.getElementById('stCountries').textContent = new Set(S.col.map(n => n.country)).size+'/5';
}

export function updateRarityStats(){
  const box = document.getElementById('rarityStats'); if(!box) return;
  const counts = S.rarityCount || {};
  const max = Math.max(1, ...RARITY_ORDER.map(r => counts[r]||0));
  box.innerHTML = RARITY_ORDER.map(rid => {
    const c = counts[rid]||0;
    const pct = max > 0 ? Math.max(2, Math.round((c/max)*100)) : 0;
    return '<div class="rarity-stat-row"><span class="rs-name '+rid+'">'+RMAP[rid].name+'</span><span class="rs-bar"><span class="rs-bar-fill '+rid+'" style="width:'+pct+'%"></span></span><span class="rs-count">'+c.toLocaleString('ru-RU')+'</span></div>';
  }).join('');
}

export function renderHistory(){
  const box = document.getElementById('historyList'); if(!box) return;
  if(!S.history.length){ box.innerHTML = '<div class="history-empty">Пока ничего не дропал</div>'; return; }
  box.innerHTML = S.history.map(h => '<div class="history-item '+h.rarity+'"><span class="rar '+h.rarity+'">'+RMAP[h.rarity].name+'</span><span class="hi-plate copy-plate" data-plate="'+h.plate+'">'+h.plate+'</span><span class="hi-price">'+h.price.toLocaleString('ru-RU')+' ₽</span></div>').join('');
  box.querySelectorAll('.copy-plate').forEach(el => el.addEventListener('click', e => {
    const p = e.currentTarget.dataset.plate;
    if(copyText(p)){ notify('📋 '+p); Sound.click(); }
  }));
}

export function updateAchievements(){
  const rare = S.col.filter(n => ['epic','legendary','mythic','divine'].includes(n.rarity)).length;
  const countries = new Set(S.col.map(n => n.country)).size;
  const ach = [
    {n:'Первый дроп', d:'Дропни 1', done: S.totalSpun >= 1},
    {n:'10 номеров', d:'Дропни 10', done: S.totalSpun >= 10},
    {n:'50 номеров', d:'Дропни 50', done: S.totalSpun >= 50},
    {n:'100 номеров', d:'Дропни 100', done: S.totalSpun >= 100},
    {n:'500 номеров', d:'Дропни 500', done: S.totalSpun >= 500},
    {n:'Редкая находка', d:'Найди редкий', done: S.col.some(n => n.rarity === 'rare')},
    {n:'Эпический', d:'Найди эпический', done: S.col.some(n => n.rarity === 'epic')},
    {n:'Легенда', d:'Найди легендарный', done: S.col.some(n => n.rarity === 'legendary')},
    {n:'Миф', d:'Найди мифический', done: S.col.some(n => n.rarity === 'mythic')},
    {n:'Божество', d:'Найди божественный', done: S.col.some(n => n.rarity === 'divine')},
    {n:'Коллекционер', d:'5+ эпик+', done: rare >= 5},
    {n:'Сотка', d:'100 000 ₽', done: S.totalEarned >= 100000},
    {n:'🪙 Обыватель', d:'5 000 ₽', done: S.rub >= 5000},
    {n:'💵 Копилка', d:'20 000 ₽', done: S.rub >= 20000},
    {n:'💰 Богач', d:'50 000 ₽', done: S.rub >= 50000},
    {n:'💎 Буржуй', d:'150 000 ₽', done: S.rub >= 150000},
    {n:'👑 Магнат', d:'500 000 ₽', done: S.rub >= 500000},
    {n:'🏛️ Олигарх', d:'2 000 000 ₽', done: S.rub >= 2000000},
    {n:'🌟 Легенда', d:'10 000 000 ₽', done: S.rub >= 10000000},
    {n:'Математик', d:'10 примеров', done: S.earnSolved >= 10},
    {n:'Отличник', d:'50 примеров', done: S.earnSolved >= 50},
    {n:'Серия 10', d:'10 подряд', done: S.earnBest >= 10},
    {n:'Глобалист', d:'5 стран', done: countries >= 5},
    {n:'Бухгалтер', d:'Прокачай бухгалтера', done: S.acct.speed + S.acct.accuracy + S.acct.risk > 0},
    {n:'Биржевик', d:'10 сделок', done: S.acct.deals >= 10}
  ];
  document.getElementById('achList').innerHTML = ach.map(a => '<div class="ach '+(a.done?'done':'')+'"><div class="an">'+a.n+'</div><div class="ad">'+a.d+'</div></div>').join('');
}
