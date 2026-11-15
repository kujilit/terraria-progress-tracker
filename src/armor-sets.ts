import type { GameClass, Item } from './types'
import armorSetData from '../data/armor-sets.json'

export interface ArmorSetPiece {
  name: string
  slot: string
  effect?: string
}

export interface ArmorSetDefinition {
  id: string
  name: string
  classes: GameClass[]
  stage: string
  pieces: ArmorSetPiece[]
  bonuses: string[]
  setBonus: string
  buffName?: string
  buffDuration?: string
}

export const armorSets = armorSetData.sets as unknown as ArmorSetDefinition[]

const lookupKey = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
const setNamesByClass = new Map<GameClass, ArmorSetDefinition[]>()

for (const gameClass of ['Melee', 'Ranger', 'Mage', 'Summoner'] as GameClass[]) {
  setNamesByClass.set(gameClass, armorSets.filter(set => set.classes.includes(gameClass)))
}

export function armorSetsForClass(gameClass: GameClass) {
  return setNamesByClass.get(gameClass) || []
}

export function armorSetForItemName(name: string, gameClass?: GameClass) {
  const key = lookupKey(name)
  return armorSets.filter(set =>
    (!gameClass || set.classes.includes(gameClass)) &&
    set.pieces.some(piece => lookupKey(piece.name) === key),
  )
}

export function armorPieceEffect(set: ArmorSetDefinition, name: string) {
  const key = lookupKey(name)
  return set.pieces.find(piece => lookupKey(piece.name) === key)?.effect || ''
}

/**
 * Weapons and armor with no class data are not shown as universal equipment.
 * Armor in the curated set index is included only for the set's damage class.
 * Accessories may remain universal when Terraria does not assign them to one class.
 */
export function isItemUsefulForClass(item: Item, gameClass: GameClass) {
  const category = item.category.toLowerCase()
  const isWeapon = category.includes('weapon') || category.includes('оруж')
  const isArmor = category.includes('armor') || category.includes('брон')
  const isAmmo = category.includes('ammo') || category.includes('боеприп')

  if (isArmor) {
    const setMatches = armorSetForItemName(item.name, gameClass)
    if (setMatches.length) return true
    if (item.classAssignment === 'unclassified-armor' || item.classAssignment === 'shared-equipment-default') return false
    if (item.gameClass.length === 4) return false
    return item.gameClass.includes(gameClass)
  }

  if (isWeapon) {
    if (item.classAssignment === 'unclassified-weapon' || item.classAssignment === 'shared-equipment-default') return false
    if (item.gameClass.length === 4) return false
    return item.gameClass.includes(gameClass)
  }

  if (isAmmo) return gameClass === 'Ranger'
  return item.gameClass.includes(gameClass)
}
