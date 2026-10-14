import { KEY } from '../config/constants.js';

const LINK_KEY = 'numdrop_link_v1';

function readBlob(){
  try {
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function readLink(){
  try {
    const raw = localStorage.getItem(LINK_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || typeof data.nick !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function localNewerThanLink(nick){
  const link = readLink();
  const local = readBlob();
  if(!link || !local || link.nick !== nick) return false;
  if(local.playerName && local.playerName !== nick) return false;
  return (local.savedAt || 0) > (link.serverSaveAt || 0);
}

export function armLink(nick){
  const link = readLink();
  if(link && link.nick === nick) return;
  const blob = readBlob();
  if(!blob) return;
  if(blob.playerName && blob.playerName !== nick) return;
  rememberLink(nick, 0);
}

export function rememberLink(nick, serverSaveAt){
  if(!nick) return;
  const at = serverSaveAt || 0;
  try {
    const blob = readBlob();
    if(blob){
      blob.savedAt = at;
      localStorage.setItem(KEY, JSON.stringify(blob));
    }
    localStorage.setItem(LINK_KEY, JSON.stringify({ nick, serverSaveAt: at }));
  } catch(e){}
}
