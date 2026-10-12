export const WEALTH_TIERS = [
  {min:0, label:'Новичок', emoji:'🌱'},
  {min:800000, label:'Обыватель', emoji:'🪙'},
  {min:2500000, label:'Копилка', emoji:'💵'},
  {min:8000000, label:'Богач', emoji:'💰'},
  {min:20000000, label:'Буржуй', emoji:'💎'},
  {min:60000000, label:'Магнат', emoji:'👑'},
  {min:180000000, label:'Олигарх', emoji:'🏛️'},
  {min:500000000, label:'Легенда', emoji:'🌟'}
];

export function wealthTierIdx(bal){ let i=0; for(let k=0;k<WEALTH_TIERS.length;k++) if(bal>=WEALTH_TIERS[k].min) i=k; return i; }
