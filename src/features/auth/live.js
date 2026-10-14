import { localNewerThanLink } from '../../services/accountLink.js';
import { renderCollection } from '../garage/view.js';
import { clearSession, fetchMe, readSession, watchProfile, writeSession } from '../../services/remote.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { market } from '../../state/market.js';
import { S } from '../../state/player.js';
import { updateBalances } from '../hud/balance.js';
import { syncAdminNav } from '../shell/secrets.js';
import { resetProgress } from '../shell/reset.js';

export function applyServer(me){
  if(!me) return;
  const session = readSession();
  if(session && typeof me.role === 'string'){
    writeSession({ token: session.token, nick: me.nick || session.nick, role: me.role });
    syncAdminNav();
  }
  if(me.banned){
    clearSession();
    location.reload();
    return;
  }
  if(typeof me.epoch === 'number' && me.epoch > (S.epoch || 0)){
    S.epoch = me.epoch;
    S.forceId = '';
    resetProgress(true);
    return;
  }
  if(me.force && me.force.id && me.force.id !== S.forceId){
    S.forceId = me.force.id;
    if(me.force.kind === 'balance'){
      S.rub = me.force.rub;
      S.peakRub = me.force.rub;
      flags.lastShownRub = null;
      updateBalances();
      save();
      notify('Баланс изменён администратором');
    } else if(me.force.kind === 'reset'){
      resetProgress(true);
    } else if(me.force.kind === 'garage'){
      S.col = [];
      S.bestNum = null;
      market.listings = [];
      flags.lastShownRub = null;
      updateBalances();
      renderCollection();
      save();
      notify('Гараж очищен администратором');
    }
  }
}

export function startProfileSync(){
  watchProfile(applyServer);
  setInterval(() => {
    fetchMe(false).then(me => {
      applyServer(me);
      const session = readSession();
      if(session && me && localNewerThanLink(session.nick)) save();
    }).catch(error => {
      if(error.payload && error.payload.reset) applyServer(error.payload);
    });
  }, 20000);
}
