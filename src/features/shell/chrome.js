import {
  PAGE_KEY,
  THEME_KEY,
} from '../../config/constants.js';
import { renderEarnProblem } from '../earn/math.js';
import { renderExchange } from '../exchange/view.js';
import { renderNews } from '../news/feed.js';
import { renderRank } from '../rank/board.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { flags } from '../../state/flags.js';

// THEME / SOUND / PAGE
export function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch(e){} }

export function toggleTheme(){ const c = document.documentElement.getAttribute('data-theme')||'light'; applyTheme(c==='dark'?'light':'dark'); Sound.click(); }

export function toggleSound(){ const n = !Sound.isEnabled(); Sound.setEnabled(n); updateSoundUI(); if(n) Sound.click(); notify(n?'🔊 Звук включён':'🔇 Звук выключен'); }

export function updateSoundUI(){ const b = document.getElementById('soundToggle'); if(b) b.classList.toggle('muted', !Sound.isEnabled()); }

export function switchPage(page){
  const valid = ['drop','earn','exchange','garage','accountant','news','rank','info'];
  if(!valid.includes(page)) page = 'drop';
  document.querySelectorAll('.topnav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-'+page));
  try { localStorage.setItem(PAGE_KEY, page); } catch(e){}
  if(page === 'earn'){ if(!flags.earnProblem) renderEarnProblem(); setTimeout(() => { const i = document.getElementById('earnInput'); if(i) i.focus(); }, 100); }
  if(page === 'news') renderNews();
  if(page === 'exchange') renderExchange();
  if(page === 'rank') renderRank();
}
