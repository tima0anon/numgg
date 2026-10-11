export const WEALTH_TIERS = [
  {min:0, label:'Новичок', emoji:'🌱'},
  {min:5000, label:'Обыватель', emoji:'🪙'},
  {min:20000, label:'Копилка', emoji:'💵'},
  {min:50000, label:'Богач', emoji:'💰'},
  {min:150000, label:'Буржуй', emoji:'💎'},
  {min:500000, label:'Магнат', emoji:'👑'},
  {min:2000000, label:'Олигарх', emoji:'🏛️'},
  {min:10000000, label:'Легенда', emoji:'🌟'}
];

export function wealthTierIdx(bal){ let i=0; for(let k=0;k<WEALTH_TIERS.length;k++) if(bal>=WEALTH_TIERS[k].min) i=k; return i; }
