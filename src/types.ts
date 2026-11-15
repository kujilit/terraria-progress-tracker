export type GameClass = 'Melee' | 'Ranger' | 'Mage' | 'Summoner'
export type ItemStatus = 'owned' | 'planned' | 'crafting' | 'missing' | 'skipped'
export interface Player { id:string; name:string; gameClass:GameClass; color:string }
export interface Item { id:string; name:string; ru:string; gameClass:GameClass[]; category:string; stage:string; icon:string; description:string; source:string; recipe?:{itemId:string;qty:number}[]; station?:string; verified:boolean }
export interface PlayerItem { playerId:string; itemId:string; status:ItemStatus; quantity:number }
export interface Boss { id:string; name:string; stage:string; requires:string[] }
