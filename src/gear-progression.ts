import type { GameClass, Item, ItemStatus } from './types'
import { armorSetForItemName, isItemUsefulForClass } from './armor-sets'

const stageRanks: Record<string, number> = {
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13,
  'pre-boss': 1, 'pre-skeletron': 4, 'pre-wall of flesh': 5,
  'pre-hardmode': 5, hardmode: 6, 'pre-mechanical bosses': 6,
  'post-mechanical': 9, 'pre-plantera': 9, 'post-plantera': 10,
  'pre-golem': 10, 'post-golem': 11, 'pre-moon lord': 12, 'post-moon lord': 13,
  'до глаза ктулху': 1, 'после глаза ктулху': 2,
  'после босса порчи или багрянца': 3, 'после скелетрона': 4,
  'подготовка к стене плоти': 5, 'после стены плоти': 6,
  'после первого механического босса': 7, 'после второго механического босса': 8,
  'после всех механических боссов': 9, 'после плантеры': 10,
  'после голема': 11, 'после лунатик-культиста': 12, 'после лунного лорда': 13,
}

export function getItemStageRank(stage: string) {
  return stageRanks[stage.trim().toLowerCase()] ?? -1
}

function categoryKey(category: string) {
  const value = category.toLowerCase()
  if (value.includes('weapon') || value.includes('оруж')) return 'weapon'
  if (value.includes('armor') || value.includes('armour') || value.includes('брон')) return 'armor'
  if (value.includes('accessory') || value.includes('аксесс')) return 'accessory'
  if (value.includes('ammo') || value.includes('боеприп')) return 'ammo'
  if (value.includes('material') || value.includes('материал')) return 'material'
  return value
}

function normalizedSlot(item: Item, gameClass: GameClass) {
  const name = item.name.toLocaleLowerCase()
  const slot = armorSetForItemName(item.name, gameClass)
    .flatMap(set => set.pieces)
    .find(piece => piece.name.toLocaleLowerCase() === name)?.slot
  if (!slot) return null
  const value = slot.toLocaleLowerCase()
  if (value.includes('голов') || value.includes('head')) return 'head'
  if (value.includes('тел') || value.includes('body') || value.includes('chest')) return 'body'
  if (value.includes('ног') || value.includes('leg')) return 'legs'
  return null
}

function comparisonKey(item: Item, gameClass: GameClass) {
  const category = categoryKey(item.category)
  if (category === 'weapon') {
    const damageType = (item.damageType || gameClass).toLocaleLowerCase().trim()
    return `weapon:${damageType}`
  }
  if (category === 'armor') {
    const slot = normalizedSlot(item, gameClass)
    return slot ? `armor:${slot}` : null
  }
  return null
}

function itemMetric(item: Item) {
  const category = categoryKey(item.category)
  if (category === 'weapon') return typeof item.damage === 'number' ? item.damage : null
  if (category === 'armor') return typeof item.defense === 'number' ? item.defense : null
  return null
}

function isStronger(candidate: Item, baseline: Item) {
  const candidateStage = getItemStageRank(candidate.stage)
  const baselineStage = getItemStageRank(baseline.stage)

  if (candidateStage >= 0 && baselineStage >= 0 && candidateStage !== baselineStage) {
    return candidateStage > baselineStage
  }
  if (candidateStage !== baselineStage) return false

  const candidateMetric = itemMetric(candidate)
  const baselineMetric = itemMetric(baseline)
  return candidateMetric !== null && baselineMetric !== null && candidateMetric > baselineMetric
}

/**
 * Hides only comparable weapon and armor upgrades when a player owns a stronger one.
 * Weapons are compared within the damage class; armor is compared within the same slot.
 * Accessories and ammo stay visible because they are not direct equipment-slot upgrades.
 */
export function getClassProgressItems(
  catalog: Item[],
  gameClass: GameClass,
  statusForItem: (itemId: string) => ItemStatus,
  hideWeaker: boolean,
) {
  const classItems = catalog.filter(item =>
    categoryKey(item.category) !== 'material' && isItemUsefulForClass(item, gameClass),
  )
  if (!hideWeaker) return classItems

  const ownedByGroup = new Map<string, Item[]>()
  for (const item of classItems) {
    if (statusForItem(item.id) !== 'owned') continue
    const key = comparisonKey(item, gameClass)
    if (!key) continue
    const group = ownedByGroup.get(key) || []
    group.push(item)
    ownedByGroup.set(key, group)
  }

  return classItems.filter(item => {
    const key = comparisonKey(item, gameClass)
    if (!key) return true
    const strongerOwned = ownedByGroup.get(key) || []
    return !strongerOwned.some(ownedItem => ownedItem.id !== item.id && isStronger(ownedItem, item))
  })
}
