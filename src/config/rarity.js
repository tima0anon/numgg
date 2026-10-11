export const RARITY = [
  {id:'common', name:'Мусор', price:20, w:75},
  {id:'uncommon', name:'Необычный', price:80, w:18},
  {id:'rare', name:'Редкий', price:400, w:6},
  {id:'epic', name:'Эпический', price:1250, w:1},
  {id:'legendary', name:'Легендарный', price:50000, w:0.01},
  {id:'mythic', name:'Мифический', price:500000, w:0.001},
  {id:'divine', name:'Божественный', price:10000000, w:0.0001}
];

export const RMAP = Object.fromEntries(RARITY.map(r => [r.id, r]));

export const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic','divine'];
