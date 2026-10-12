export const RARITY = [
  {id:'common', name:'Мусор', price:40, w:64},
  {id:'uncommon', name:'Необычный', price:160, w:22},
  {id:'rare', name:'Редкий', price:520, w:9},
  {id:'epic', name:'Эпический', price:1800, w:4},
  {id:'legendary', name:'Легендарный', price:22000, w:0.85},
  {id:'mythic', name:'Мифический', price:180000, w:0.13},
  {id:'divine', name:'Божественный', price:3500000, w:0.02}
];

export const RMAP = Object.fromEntries(RARITY.map(r => [r.id, r]));

export const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic','divine'];
