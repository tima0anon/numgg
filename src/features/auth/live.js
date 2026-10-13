import { clearSession, fetchMe, watchProfile } from '../../services/remote.js';
import { notify } from '../../services/notify.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';
import { updateBalances } from '../hud/balance.js';
import { resetProgress } from '../shell/reset.js';

export function applyServer(me){
  if(!me) return;
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
    }
  }
}

export function startProfileSync(){
  watchProfile(applyServer);
  setInterval(() => {
    fetchMe().then(applyServer).catch(error => {
      if(error.payload && error.payload.reset) applyServer(error.payload);
    });
  }, 8000);
}
