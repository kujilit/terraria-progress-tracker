import type {Boss, Item, Player} from './types'
export const players:Player[]=[
{id:'p1',name:'Misha',gameClass:'Melee',color:'#d98d54'},
{id:'p2',name:'Ranger',gameClass:'Ranger',color:'#79a8d8'},
{id:'p3',name:'Mage',gameClass:'Mage',color:'#a88add'},
{id:'p4',name:'Summoner',gameClass:'Summoner',color:'#76b98c'}]
export const items:Item[]=[
{id:'night_edge',name:"Night's Edge",ru:'Край ночи',gameClass:['Melee'],category:'Оружие',stage:'Pre-Hardmode',icon:'⚔️',description:'Мощный меч до перехода в Hardmode.',source:'Крафт на Demon / Crimson Altar',recipe:[{itemId:'muramasa',qty:1},{itemId:'blade_grass',qty:1},{itemId:'fiery_greatsword',qty:1}],station:'Demon / Crimson Altar',verified:false},
{id:'muramasa',name:'Muramasa',ru:'Мурамаса',gameClass:['Melee'],category:'Оружие',stage:'Pre-Hardmode',icon:'🗡️',description:'Находится в сундуках Dungeon.',source:'Dungeon chest',verified:false},
{id:'blade_grass',name:'Blade of Grass',ru:'Клинок травы',gameClass:['Melee'],category:'Оружие',stage:'Pre-Hardmode',icon:'🌿',description:'Создаётся из материалов джунглей.',source:'Crafting',verified:false},
{id:'fiery_greatsword',name:'Fiery Greatsword',ru:'Огненный двуручник',gameClass:['Melee'],category:'Оружие',stage:'Pre-Hardmode',icon:'🔥',description:'Создаётся из Hellstone Bars.',source:'Crafting',verified:false},
{id:'terra_blade',name:'Terra Blade',ru:'Терра-клинок',gameClass:['Melee'],category:'Оружие',stage:'Hardmode',icon:'🟩',description:'Один из ключевых мечей позднего Hardmode.',source:'Crafting',recipe:[{itemId:'true_nights_edge',qty:1},{itemId:'true_excalibur',qty:1},{itemId:'broken_hero_sword',qty:1}],station:'Mythril / Orichalcum Anvil',verified:false},
{id:'true_nights_edge',name:"True Night's Edge",ru:'Истинный Край ночи',gameClass:['Melee'],category:'Оружие',stage:'Hardmode',icon:'🌑',description:'Компонент Terra Blade.',source:'Crafting',recipe:[{itemId:'night_edge',qty:1}],station:'Mythril / Orichalcum Anvil',verified:false},
{id:'true_excalibur',name:'True Excalibur',ru:'Истинный Экскалибур',gameClass:['Melee'],category:'Оружие',stage:'Hardmode',icon:'✨',description:'Компонент Terra Blade.',source:'Crafting',recipe:[{itemId:'excalibur',qty:1}],station:'Mythril / Orichalcum Anvil',verified:false},
{id:'broken_hero_sword',name:'Broken Hero Sword',ru:'Сломанный меч героя',gameClass:['Melee'],category:'Материал',stage:'Hardmode',icon:'🗡️',description:'Материал для создания Terra Blade.',source:'Mothron',verified:false},
{id:'excalibur',name:'Excalibur',ru:'Экскалибур',gameClass:['Melee'],category:'Оружие',stage:'Hardmode',icon:'⚔️',description:'Создаётся из Hallowed Bars.',source:'Crafting',verified:false},
{id:'megashark',name:'Megashark',ru:'Мегакула',gameClass:['Ranger'],category:'Оружие',stage:'Hardmode',icon:'🦈',description:'Огнестрельное оружие для Ranger.',source:'Crafting',verified:false},
{id:'meteor_staff',name:'Meteor Staff',ru:'Метеоритный посох',gameClass:['Mage'],category:'Оружие',stage:'Hardmode',icon:'☄️',description:'Магическое оружие.',source:'Crafting',verified:false},
{id:'spider_staff',name:'Spider Staff',ru:'Паучий посох',gameClass:['Summoner'],category:'Призыв',stage:'Hardmode',icon:'🕷️',description:'Посох призыва пауков.',source:'Spider Caves',verified:false}
]
export const bosses:Boss[]=[
{id:'king_slime',name:'King Slime',stage:'Pre-Hardmode',requires:[]},
{id:'eye',name:'Eye of Cthulhu',stage:'Pre-Hardmode',requires:[]},
{id:'eater',name:'Eater of Worlds / Brain of Cthulhu',stage:'Pre-Hardmode',requires:[]},
{id:'skeletron',name:'Skeletron',stage:'Pre-Hardmode',requires:[]},
{id:'wof',name:'Wall of Flesh',stage:'Hardmode',requires:['skeletron']},
{id:'mechs',name:'Mechanical Bosses',stage:'Hardmode',requires:['wof']},
{id:'plantera',name:'Plantera',stage:'Hardmode',requires:['mechs']},
{id:'golem',name:'Golem',stage:'Hardmode',requires:['plantera']},
{id:'cultist',name:'Lunatic Cultist',stage:'Endgame',requires:['golem']},
{id:'moon_lord',name:'Moon Lord',stage:'Endgame',requires:['cultist']}
]
