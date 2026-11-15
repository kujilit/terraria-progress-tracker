export type GameClass = 'Melee' | 'Ranger' | 'Mage' | 'Summoner'
export type ItemStatus = 'owned' | 'planned' | 'crafting' | 'missing' | 'skipped'
export interface Player { id:string; name:string; gameClass:GameClass; color:string }
export interface RecipeIngredient { itemId:string; name?:string; qty:number; alternatives?:{name:string;item_key:string}[] }
export interface CatalogRecipe { id:string; station?:string|null; amount:number; version?:string|null; ingredients:RecipeIngredient[] }
export interface Item {
  id:string; name:string; ru:string; gameClass:GameClass[]; category:string; stage:string
  icon:string; description:string; source:string; recipe?:{itemId:string;qty:number}[]
  station?:string; recipes?:CatalogRecipe[]; verified:boolean
  imageUrl?:string|null; imageOriginalUrl?:string|null; imagePageUrl?:string|null; imageFile?:string|null
  classAssignment?:string|null; damage?:number|null; damageType?:string|null; defense?:number|null
  equipmentEffect?:string|null; armorSetId?:string|null; armorSetName?:string|null; armorSetBonus?:string|null
  buffName?:string|null; buffDuration?:string|null
}
export interface PlayerItem { playerId:string; itemId:string; status:ItemStatus; quantity:number }
export interface Boss { id:string; name:string; stage:string; requires:string[] }
