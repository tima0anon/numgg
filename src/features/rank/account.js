import { fetchInbox, loginAccount, logoutAccount, queueScore, readSession, registerAccount, takeGift, writeSession } from '../../services/remote.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';
import { renderCollection } from '../garage/view.js';
import { renderRank } from './board.js';
import { updateBalances } from '../hud/balance.js';

let mode = 'login';

function paint(){
  const session = readSession();
  const guest = document.getElementById('rankGuest');
  const user = document.getElementById('rankUser');
  if(guest) guest.hidden = !!session;
  if(user) user.hidden = !session;
  const account = document.getElementById('rankAccount');
  if(account && session) account.textContent = session.nick + ' · место в топе по максимальному балансу';
  const button = document.getElementById('rankAuth');
  if(button) button.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
}

export function bindRankAccount(){
  paint();
  const loginTab = document.getElementById('rankTabLogin');
  const regTab = document.getElementById('rankTabReg');
  if(!loginTab) return;
  loginTab.addEventListener('click', () => { mode = 'login'; loginTab.classList.add('active'); regTab.classList.remove('active'); paint(); });
  regTab.addEventListener('click', () => { mode = 'register'; regTab.classList.add('active'); loginTab.classList.remove('active'); paint(); });
  document.getElementById('rankAuth').addEventListener('click', async () => {
    const err = document.getElementById('rankAuthError');
    const nick = document.getElementById('rankNick').value;
    const password = document.getElementById('rankPass').value;
    err.textContent = '';
    try {
      const data = mode === 'login' ? await loginAccount(nick, password) : await registerAccount(nick, password);
      writeSession(data);
      document.getElementById('rankPass').value = '';
      Sound.click();
      paint();
      queueScore(Math.max(S.rub, S.peakRub || 0));
      renderRank();
      notify(mode === 'login' ? 'Вход выполнен' : 'Аккаунт создан');
    } catch(error){
      err.textContent = error.message || 'Не вышло';
      Sound.error();
    }
  });
  document.getElementById('rankLogout').addEventListener('click', () => { logoutAccount(); paint(); notify('Вы вышли'); });
  document.getElementById('rankInbox').addEventListener('click', claimInbox);
}

export async function claimInbox(){
  if(!readSession()){ notify('Сначала войди'); return; }
  try {
    const data = await fetchInbox();
    const gifts = data.gifts || [];
    if(!gifts.length){ notify('Новых номеров нет'); return; }
    let taken = 0;
    for(const gift of gifts){
      const row = await takeGift(gift.id);
      const plate = row.plate;
      if(!plate) continue;
      const item = { id: S.nextId++, country: plate.country || '', flag: plate.flag, plate: plate.plate, rarity: plate.rarity, price: plate.price || 0, bought: plate.bought || 0, favorite: false, region: plate.region || null };
      S.col.push(item);
      S.rarityCount[item.rarity] = (S.rarityCount[item.rarity] || 0) + 1;
      taken++;
    }
    updateBalances(); renderCollection(); save();
    notify('Забрано номеров: ' + taken);
  } catch(error){
    notify(error.message || 'Не удалось забрать номера');
    Sound.error();
  }
}
