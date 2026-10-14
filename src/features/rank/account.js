import { fetchInbox, logoutAccount, readSession, takeGift } from '../../services/remote.js';
import { Sound } from '../../services/audio.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { S } from '../../state/player.js';
import { renderCollection } from '../garage/view.js';
import { updateBalances } from '../hud/balance.js';

export function bindRankAccount(){
  const session = readSession();
  const account = document.getElementById('rankAccount');
  if(account && session) account.textContent = session.nick + ' · место в топе по текущему балансу';
  const inbox = document.getElementById('rankInbox');
  const logout = document.getElementById('rankLogout');
  if(inbox) inbox.addEventListener('click', claimInbox);
  if(logout) logout.addEventListener('click', () => { logoutAccount().finally(() => location.reload()); });
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
