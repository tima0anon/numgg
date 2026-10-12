import { ACCT_AUTO_COST, ACCT_HIRE_COST } from '../../config/constants.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { updateBalances } from '../hud/balance.js';
import { S } from '../../state/player.js';
import { acctCoverage, autoSlots, effectiveThreshold, noticeChance } from './session.js';

export function acctUpgradeCost(kind){
  const lvl = S.acct[kind];
  const base = kind === 'speed' ? 800 : kind === 'accuracy' ? 1200 : 600;
  return Math.floor(base * Math.pow(2.1, lvl));
}

function pct(value){ return Math.round(value * 100); }

function esc(value){
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function paintButton(id, kind){
  const button = document.getElementById(id);
  const cost = acctUpgradeCost(kind);
  const maxed = S.acct[kind] >= 8;
  button.innerHTML = maxed ? 'Максимум' : 'Купить <span>'+cost.toLocaleString('ru-RU')+'</span> ₽';
  button.disabled = maxed || S.rub < cost;
}

export function updateAcctUI(){
  document.querySelectorAll('#acctMode button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === S.acct.mode);
    if(b.dataset.mode === 'notify') b.textContent = S.acct.hired ? 'Подсказки' : 'Подсказки · '+ACCT_HIRE_COST.toLocaleString('ru-RU')+' ₽';
    if(b.dataset.mode === 'auto') b.textContent = S.acct.autoPaid ? 'Сам торгует' : 'Сам торгует · '+ACCT_AUTO_COST.toLocaleString('ru-RU')+' ₽';
  });
  document.getElementById('acctAnalyzed').textContent = S.acct.analyzed.toLocaleString('ru-RU');
  document.getElementById('acctFound').textContent = S.acct.found.toLocaleString('ru-RU');
  document.getElementById('acctDeals').textContent = S.acct.deals.toLocaleString('ru-RU');
  document.getElementById('acctProfit').textContent = Math.round(S.acct.profit).toLocaleString('ru-RU') + ' ₽';
  document.getElementById('acctSpeedLvl').textContent = S.acct.speed;
  document.getElementById('acctAccuracyLvl').textContent = S.acct.accuracy;
  document.getElementById('acctRiskLvl').textContent = S.acct.risk;
  document.getElementById('acctThresholdVal').textContent = S.acct.threshold;
  paintButton('buyAcctSpeed', 'speed');
  paintButton('buyAcctAccuracy', 'accuracy');
  paintButton('buyAcctRisk', 'risk');

  const cover = acctCoverage();
  const threshold = effectiveThreshold();
  const status = document.getElementById('acctStatus');
  const rules = document.getElementById('acctRules');
  if(S.acct.mode === 'off') status.textContent = 'Выключен. Биржу не смотрит и деньги не тратит.';
  else if(S.acct.mode === 'notify') status.textContent = 'Подсказывает. Деньги не тратит, пока сам не нажмёшь кнопку у сделки.';
  else status.textContent = 'Сам торгует. Закрывает до ' + autoSlots() + ' лучших сделок за сессию, остальные оставляет кнопками.';
  rules.textContent = 'Порог ' + pct(threshold) + '% · смотрит до ' + cover.offers + ' лотов и ' + cover.orders + ' заказов · замечает ' + pct(noticeChance()) + '% выгодных';
  document.getElementById('acctSpeedDesc').textContent = 'Сейчас успевает просмотреть до ' + cover.offers + ' лотов и ' + cover.orders + ' заказов. Следующий уровень добавляет ещё 4 лота и 2 заказа.';
  document.getElementById('acctAccuracyDesc').textContent = 'Сейчас замечает ' + pct(noticeChance()) + '% сделок, которые и правда выгоднее порога. Ошибочные оценки показывает отдельно и сам их не покупает.';
  document.getElementById('acctRiskDesc').textContent = 'Каждый уровень снижает порог на 1,5%. Сейчас он берёт сделки от ' + pct(threshold) + '%.';

  const session = document.getElementById('acctSession');
  const report = S.acct.report;
  if(!report || S.acct.mode === 'off') session.textContent = 'Отчёт появится, когда начнётся сессия биржи — каждые 15 секунд.';
  else session.textContent = 'Последняя сессия: ' + report.offersSeen + ' из ' + report.offersTotal + ' лотов, ' + report.ordersSeen + ' из ' + report.ordersTotal + ' заказов. Нашёл ' + report.found + ', купил ' + report.bought + ', продал ' + report.sold + '.';

  const box = document.getElementById('acctAdvice');
  const advice = report && S.acct.mode !== 'off' ? report.advice : [];
  if(!advice.length){
    box.innerHTML = '<div class="empty">Сейчас нет предложений. Если порог высокий, снизь его или прокачай охват.</div>';
    return;
  }
  box.innerHTML = advice.map(item => {
    const sign = item.edge >= 0 ? '+' : '−';
    const title = item.kind === 'buy'
      ? esc(item.plate) + ' за ' + item.price.toLocaleString('ru-RU') + ' ₽'
      : esc(item.plate) + ' в заказ ' + esc(item.mask);
    const detail = item.kind === 'buy'
      ? 'Рынок ' + item.market.toLocaleString('ru-RU') + ' ₽ · ' + sign + Math.abs(pct(item.edge)) + '%'
      : 'Награда ' + item.price.toLocaleString('ru-RU') + ' ₽ · рынок номера ' + item.market.toLocaleString('ru-RU') + ' ₽ · ' + sign + Math.abs(pct(item.edge)) + '%';
    let action = '';
    if(item.suspect) action = '<span class="acct-flag">сомнительно</span>';
    else if(item.done) action = '<span class="acct-flag ok">сделано</span>';
    else action = '<button type="button" class="ios-btn" data-act="1" data-kind="'+item.kind+'" data-id="'+esc(item.id)+'" data-num="'+(item.numId == null ? '' : item.numId)+'">'+(item.kind === 'buy' ? 'Купить' : 'Продать')+'</button>';
    return '<div class="acct-deal'+(item.suspect ? ' suspect' : '')+(item.done ? ' done' : '')+'"><div><div class="t">'+title+'</div><div class="d">'+detail+'</div></div>'+action+'</div>';
  }).join('');
}

export function buyAcctSkill(kind){
  const cost = acctUpgradeCost(kind);
  if(S.rub < cost || S.acct[kind] >= 8) return;
  S.rub -= cost;
  S.totalSpent += cost;
  S.acct[kind]++;
  Sound.buy();
  updateBalances();
  updateAcctUI();
  save();
  notify('📒 ' + ({ speed: 'охват', accuracy: 'глазомер', risk: 'азарт' })[kind] + ' → ' + S.acct[kind]);
}
