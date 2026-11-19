import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Sparkles, Shield } from 'lucide-react'
import type { Item, Player } from './types'
import { armorSetsForClass, isItemUsefulForClass } from './armor-sets'
import { classStages } from './class-progression'
import { getItemStageRank } from './gear-progression'

type Slot = 'head' | 'body' | 'legs' | 'weapon' | 'accessory1' | 'accessory2' | 'accessory3'
type Slots = Record<Slot, string>
const empty: Slots = { head: '', body: '', legs: '', weapon: '', accessory1: '', accessory2: '', accessory3: '' }
const slots: { id: Slot; label: string; category: string }[] = [
  { id: 'head', label: 'Голова', category: 'armor' }, { id: 'body', label: 'Тело', category: 'armor' },
  { id: 'legs', label: 'Ноги', category: 'armor' }, { id: 'weapon', label: 'Оружие', category: 'weapon' },
  { id: 'accessory1', label: 'Аксессуар I', category: 'accessory' }, { id: 'accessory2', label: 'Аксессуар II', category: 'accessory' },
  { id: 'accessory3', label: 'Аксессуар III', category: 'accessory' },
]
const category = (value: string) => value.toLowerCase().includes('armor') || value.toLowerCase().includes('брон') ? 'armor'
  : value.toLowerCase().includes('weapon') || value.toLowerCase().includes('оруж') ? 'weapon'
  : value.toLowerCase().includes('accessory') || value.toLowerCase().includes('аксесс') ? 'accessory' : value.toLowerCase().includes('summon') || value.toLowerCase().includes('призыв') ? 'weapon' : value.toLowerCase()
const stageRank = (stage: string) => /^\d+$/.test(stage) ? Number(stage) : Math.max(1, getItemStageRank(stage) + 1)
const stageTitle = (gameClass: Player['gameClass'], stage: string) => /^\d+$/.test(stage) ? (classStages[gameClass].find(entry => entry.id.endsWith('-' + stage))?.title || 'Этап ' + stage) : ({ 'Pre-Hardmode': 'До хардмода', Hardmode: 'Хардмод', 'Post-Mechanical': 'После механических боссов', 'Post-Plantera': 'После Плантеры', 'Post-Golem': 'После Голема', 'Post-Moon Lord': 'Финальный этап' } as Record<string, string>)[stage] || stage
const armorSlotFor = (value: string): Slot | null => { const v = value.toLowerCase(); if (v.includes('head') || v.includes('голов') || v.includes('шлем')) return 'head'; if (v.includes('leg') || v.includes('ног') || v.includes('понож')) return 'legs'; if (v.includes('body') || v.includes('chest') || v.includes('тел') || v.includes('нагруд')) return 'body'; return null }

export function CharacterLoadout({ player, items, statusForItem, disabled, onOpenCatalog }: {
  player: Player; items: Item[]; statusForItem: (id: string) => string; disabled?: boolean; onOpenCatalog: () => void
}) {
  const key = 'terraria-character-loadout:' + player.id
  const [loadout, setLoadout] = useState<Slots>(() => {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return empty }
  })
  useEffect(() => { try { setLoadout({ ...empty, ...JSON.parse(localStorage.getItem(key) || '{}') }) } catch { setLoadout(empty) } }, [key])
  useEffect(() => { localStorage.setItem(key, JSON.stringify(loadout)) }, [key, loadout])
  const classItems = useMemo(() => items.filter(item => isItemUsefulForClass(item, player.gameClass)), [items, player.gameClass])
  const armorSlot = useMemo(() => {
    const result = new Map<string, Slot>()
    armorSetsForClass(player.gameClass).forEach(set => set.pieces.forEach(piece => {
      const slot = armorSlotFor(piece.slot)
      if (slot) result.set(piece.name, slot)
    }))
    return result
  }, [player.gameClass])
  const itemFor = (id: string) => classItems.find(item => item.id === id)
  const options = (slot: typeof slots[number]) => classItems.filter(item => category(item.category) === slot.category &&
    (slot.category !== 'armor' || armorSlot.get(item.name) === slot.id))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.name.localeCompare(b.name))
  const equipped = new Set(Object.values(loadout).filter(Boolean))
  const recommendationIds = new Set<string>()
  const recommendations = slots.map(slot => {
    const current = itemFor(loadout[slot.id])
    const ownedRank = options(slot).filter(item => statusForItem(item.id) === 'owned')
      .reduce((rank, item) => Math.max(rank, stageRank(item.stage)), 0)
    const baselineRank = Math.max(current ? stageRank(current.stage) : 0, ownedRank)
    const next = options(slot).filter(item => !equipped.has(item.id) && !recommendationIds.has(item.id) && !['owned', 'skipped'].includes(statusForItem(item.id)))
      .filter(item => stageRank(item.stage) > baselineRank)
      .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.name.localeCompare(b.name))[0]
    if (next) recommendationIds.add(next.id)
    return next ? { ...next, slotLabel: slot.label, status: statusForItem(next.id) } : null
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage)).slice(0, 6)
  const equippedCount = Object.values(loadout).filter(Boolean).length

  return <section className="character-loadout-page">
    <header className="character-loadout-header">
      <div><span className="eyebrow">ПЕРСОНАЖ / ЭКИПИРОВКА</span><h2>{player.name}</h2><p>{player.gameClass === 'Melee' ? 'Ближний бой' : player.gameClass === 'Ranger' ? 'Стрелок' : player.gameClass === 'Mage' ? 'Маг' : 'Призыватель'} · Текущие слоты и дальнейшее развитие</p></div>
      <div className="character-progress"><b>{equippedCount}/7</b><span>слотов заполнено</span><div><i style={{ width: (equippedCount / 7 * 100) + '%' }}/></div></div>
    </header>
    <div className="character-loadout-grid">
      <section className="character-equipment-panel">
        <div className="character-panel-title"><div><span className="eyebrow">CURRENT LOADOUT</span><h3>Текущая экипировка</h3></div><span>{equippedCount}/7 слотов</span></div>
        <div className="terraria-equipment-layout">
          <div className="terraria-equipment-group">
            <div className="terraria-equipment-group-title">Броня</div>
            {slots.filter(slot => slot.category === 'armor').map(slot => {
              const selected = itemFor(loadout[slot.id])
              return <label className="terraria-equipment-slot" key={slot.id}>
                <span className="terraria-slot-label">{slot.label}</span>
                <span className={"terraria-slot-icon" + (selected ? ' is-filled' : '')}>
                  {selected ? selected.icon : slot.id === 'head' ? '◈' : slot.id === 'body' ? '▣' : '▤'}
                </span>
                <select aria-label={slot.label} value={loadout[slot.id]} disabled={disabled} onChange={event => setLoadout(current => ({ ...current, [slot.id]: event.target.value }))}>
                  <option value="">Пусто</option>{options(slot).map(item => <option key={item.id} value={item.id}>{item.ru || item.name}</option>)}
                </select>
                {selected && <small title={selected.name}>{selected.ru || selected.name}</small>}
              </label>
            })}
          </div>
          <div className="terraria-equipment-group">
            <div className="terraria-equipment-group-title">Аксессуары</div>
            {slots.filter(slot => slot.category === 'accessory').map(slot => {
              const selected = itemFor(loadout[slot.id])
              return <label className="terraria-equipment-slot" key={slot.id}>
                <span className="terraria-slot-label">{slot.label}</span>
                <span className={"terraria-slot-icon" + (selected ? ' is-filled' : '')}>{selected ? selected.icon : '◇'}</span>
                <select aria-label={slot.label} value={loadout[slot.id]} disabled={disabled} onChange={event => setLoadout(current => ({ ...current, [slot.id]: event.target.value }))}>
                  <option value="">Пусто</option>{options(slot).map(item => <option key={item.id} value={item.id}>{item.ru || item.name}</option>)}
                </select>
                {selected && <small title={selected.name}>{selected.ru || selected.name}</small>}
              </label>
            })}
          </div>
          <div className="terraria-equipment-group terraria-weapon-group">
            <div className="terraria-equipment-group-title">Оружие</div>
            {slots.filter(slot => slot.id === 'weapon').map(slot => {
              const selected = itemFor(loadout[slot.id])
              return <label className="terraria-equipment-slot" key={slot.id}>
                <span className="terraria-slot-label">{slot.label}</span>
                <span className={"terraria-slot-icon" + (selected ? ' is-filled' : '')}>{selected ? selected.icon : '⚔'}</span>
                <select aria-label={slot.label} value={loadout[slot.id]} disabled={disabled} onChange={event => setLoadout(current => ({ ...current, [slot.id]: event.target.value }))}>
                  <option value="">Пусто</option>{options(slot).map(item => <option key={item.id} value={item.id}>{item.ru || item.name}</option>)}
                </select>
                {selected && <small title={selected.name}>{selected.ru || selected.name}</small>}
              </label>
            })}
          </div>
        </div>
        {disabled && <p className="character-readonly-note">Редактировать экипировку можно только у своего персонажа.</p>}
      </section>
      <aside className="character-roadmap-panel">
        <div className="character-panel-title"><div><span className="eyebrow">NEXT UP</span><h3>Рекомендуемое развитие</h3></div><Sparkles size={19}/></div>
        {recommendations.length ? <>
          <div className="roadmap-current-stage"><span>Ближайшие цели</span><b>{stageTitle(player.gameClass, recommendations[0].stage)}</b></div>
          <div className="roadmap-track">{recommendations.map((item, index) => <article className="roadmap-node" key={item.id}>
            <span className="roadmap-node-index">{index + 1}</span><div className="roadmap-node-copy"><small>{item.slotLabel} · {stageTitle(player.gameClass, item.stage)}</small><b>{item.ru || item.name}</b><span>{item.name}</span></div>
            <span className={"roadmap-node-status status-" + item.status}>{item.status === 'crafting' ? 'В работе' : item.status === 'planned' ? 'В планах' : 'Не получено'}</span>
          </article>)}</div>
        </> : <div className="roadmap-complete"><Shield size={24}/><b>Основные цели закрыты</b><span>Для этого класса пока нет следующих рекомендаций.</span></div>}
        <button className="character-catalog-link" type="button" onClick={onOpenCatalog}>Открыть полный каталог <ArrowRight size={15}/></button>
      </aside>
    </div>
  </section>
}
