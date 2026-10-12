export const RARITY = [
  {id:'common', name:'Мусор', price:4500, w:73.2},
  {id:'uncommon', name:'Необычный', price:28000, w:18.7},
  {id:'rare', name:'Редкий', price:95000, w:6.5},
  {id:'epic', name:'Эпический', price:320000, w:1.5},
  {id:'legendary', name:'Легендарный', price:1400000, w:0.15},
  {id:'mythic', name:'Мифический', price:4800000, w:0.0225},
  {id:'divine', name:'Божественный', price:15000000, w:0.0034}
];

export const RMAP = Object.fromEntries(RARITY.map(r => [r.id, r]));

export const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic','divine'];
