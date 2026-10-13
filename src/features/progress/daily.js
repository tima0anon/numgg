import { DAILY_BONUS, DAILY_KEY } from '../../config/constants.js';
import { updateBalances } from '../hud/balance.js';
import { Sound } from '../../services/audio.js';
import { spawnConfetti } from '../../services/fx.js';
import { haptic } from '../../services/haptic.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';

// DAILY
export function getDailyLast(){ try { return parseInt(localStorage.getItem(DAILY_KEY),10)||0; } catch(e){ return 0; } }

export function setDailyLast(t){ try { localStorage.setItem(DAILY_KEY, String(t)); } catch(e){} }

export function msToNextDaily(){ return Math.max(0, getDailyLast() + 24*60*60*1000 - Date.now()); }

export function fmtTime(ms){ const s = Math.floor(ms/1000); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60; return h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); }

export function updateDailyUI(){
  const btn = document.getElementById('dailyBtn'), sub = document.getElementById('dailySub');
  if(!btn || !sub) return;
  const left = msToNextDaily();
  if(left <= 0){ btn.disabled = false; btn.classList.add('gold'); btn.textContent = 'Забрать'; sub.textContent = 'Можно забрать сумму одной крутки'; }
  else { btn.disabled = true; btn.classList.remove('gold'); btn.textContent = fmtTime(left); sub.textContent = 'Следующий бонус через '+fmtTime(left); }
}

export function claimDaily(){
  if(msToNextDaily() > 0){ notify('Бонус ещё не готов'); Sound.error(); return; }
  const bonus = DAILY_BONUS;
  S.rub += bonus; S.totalEarned += bonus;
  setDailyLast(Date.now());
  Sound.coin_big(); haptic([25,25,50]); spawnConfetti(50, ['#ffcc00','#ff9500','#ffd60a']);
  updateBalances(); save();
  notify('🎁 +'+bonus.toLocaleString('ru-RU')+' ₽');
}
