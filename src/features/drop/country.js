import { renderRealPlate } from '../../domain/plates/render.js';
import { updateDropCostsUI } from './spin.js';
import { Sound } from '../../services/audio.js';
import { save } from '../../services/storage.js';
import { flags } from '../../state/flags.js';
import { S } from '../../state/player.js';

// COUNTRY PICKER
export function syncCountryPickerUI(){ document.querySelectorAll('#countryPicker .cpill').forEach(b => b.classList.toggle('active', b.dataset.country === S.selectedCountry)); }

export function applyCountryPreview(){
  if(flags.spinning) return;
  const sampleMap = {all:{plate:'А123ВС 77',flag:'ru'},ru:{plate:'А123ВС 77',flag:'ru'},by:{plate:'1234 АВ-7',flag:'by'},cn:{plate:'京A 12345',flag:'cn'},us:{plate:'ABC 1234',flag:'us'},ua:{plate:'АА 1234 ВВ',flag:'ua'}};
  const p = sampleMap[S.selectedCountry] || sampleMap.all;
  document.getElementById('plateRender').innerHTML = renderRealPlate(p.plate, p.flag, 'lg');
  document.getElementById('plateDisplay').className = 'plate-display rarity-common';
}

export function selectCountry(id){
  if(!['all','ru','by','cn','us','ua'].includes(id)) return;
  S.selectedCountry = id;
  Sound.click(); save(); syncCountryPickerUI(); applyCountryPreview(); updateDropCostsUI();
}
