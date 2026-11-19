import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Sparkles, Shield, GitBranch } from 'lucide-react'
import type { Item, Player } from './types'
import { armorSetsForClass, isItemUsefulForClass } from './armor-sets'
import { classStages } from './class-progression'
import { getItemStageRank } from './gear-progression'
import { accessoryBuilds } from './accessory-builds'

type Slot = 'head' | 'body' | 'legs' | 'weapon' | 'whip' | 'accessory1' | 'accessory2' | 'accessory3' | 'accessory4' | 'accessory5' | 'accessory6' | 'accessory7'
type Slots = Record<Slot, string>
const empty: Slots = { head: '', body: '', legs: '', weapon: '', whip: '', accessory1: '', accessory2: '', accessory3: '', accessory4: '', accessory5: '', accessory6: '', accessory7: '' }
const slots: { id: Slot; label: string; category: string }[] = [
  { id: 'head', label: 'Голова', category: 'armor' }, { id: 'body', label: 'Тело', category: 'armor' },
  { id: 'legs', label: 'Ноги', category: 'armor' }, { id: 'weapon', label: 'Оружие', category: 'weapon' }, { id: 'whip', label: 'Кнут', category: 'whip' },
  { id: 'accessory1', label: 'Аксессуар I', category: 'accessory' }, { id: 'accessory2', label: 'Аксессуар II', category: 'accessory' },
  { id: 'accessory3', label: 'Аксессуар III', category: 'accessory' },
  { id: 'accessory4', label: 'Аксессуар IV', category: 'accessory' },
  { id: 'accessory5', label: 'Аксессуар V', category: 'accessory' },
  { id: 'accessory6', label: 'Аксессуар VI', category: 'accessory' },
  { id: 'accessory7', label: 'Аксессуар VII', category: 'accessory' },
]
const category = (value: string) => value.toLowerCase().includes('armor') || value.toLowerCase().includes('брон') ? 'armor'
  : value.toLowerCase().includes('weapon') || value.toLowerCase().includes('оруж') ? 'weapon'
  : value.toLowerCase().includes('accessory') || value.toLowerCase().includes('аксесс') ? 'accessory' : value.toLowerCase().includes('summon') || value.toLowerCase().includes('призыв') ? 'weapon' : value.toLowerCase()
const stageRank = (stage: string) => /^\d+$/.test(stage) ? Number(stage) : Math.max(1, getItemStageRank(stage) + 1)
const stageTitle = (gameClass: Player['gameClass'], stage: string) => /^\d+$/.test(stage) ? (classStages[gameClass].find(entry => entry.id.endsWith('-' + stage))?.title || 'Этап ' + stage) : ({ 'Pre-Hardmode': 'До хардмода', Hardmode: 'Хардмод', 'Post-Mechanical': 'После механических боссов', 'Post-Plantera': 'После Плантеры', 'Post-Golem': 'После Голема', 'Post-Moon Lord': 'Финальный этап' } as Record<string, string>)[stage] || stage
const armorSlotFor = (value: string): Slot | null => { const v = value.toLowerCase(); if (v.includes('head') || v.includes('голов') || v.includes('шлем')) return 'head'; if (v.includes('leg') || v.includes('ног') || v.includes('понож')) return 'legs'; if (v.includes('body') || v.includes('chest') || v.includes('тел') || v.includes('нагруд')) return 'body'; return null }

export function CharacterLoadout({ player, items, statusForItem, disabled, onOpenCatalog, onOpenCraft }: {
  player: Player; items: Item[]; statusForItem: (id: string) => string; disabled?: boolean; onOpenCatalog: () => void; onOpenCraft: (item: Item) => void
}) {
  const key = 'terraria-character-loadout:' + player.id
  const [openSlot, setOpenSlot] = useState<Slot | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [accessorySlots, setAccessorySlots] = useState<6 | 7>(() => localStorage.getItem(key + ':accessory-slots') === '6' ? 6 : 7)
  const activeSlots = slots.filter(slot => (slot.id !== 'whip' || player.gameClass === 'Summoner') && (!slot.id.startsWith('accessory') || Number(slot.id.replace('accessory', '')) <= accessorySlots))
  const [loadout, setLoadout] = useState<Slots>(() => {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return empty }
  })
  useEffect(() => { try { setLoadout({ ...empty, ...JSON.parse(localStorage.getItem(key) || '{}') }) } catch { setLoadout(empty) } }, [key])
  useEffect(() => { localStorage.setItem(key, JSON.stringify(loadout)) }, [key, loadout])
  useEffect(() => { localStorage.setItem(key + ':accessory-slots', String(accessorySlots)) }, [key, accessorySlots])
  const accessoryItems = useMemo(() => {
    const unique = new Map<string, Item>()
    accessoryBuilds[player.gameClass].flatMap(build => build.items).forEach(entry => {
      const id = 'accessory-' + player.gameClass.toLowerCase() + '-' + entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      if (!unique.has(id)) unique.set(id, { id, name: entry.name, ru: entry.name, gameClass: [player.gameClass], category: 'Аксессуар', stage: entry.stage, icon: '◇', description: entry.effect, source: 'Рекомендации аксессуарных сборок', verified: true, imageUrl: 'https://terraria.wiki.gg/wiki/Special:FilePath/' + encodeURIComponent(entry.name + '.png') })
    })
    return [...unique.values()]
  }, [player.gameClass])
  const classItems = useMemo(() => [...items.filter(item => isItemUsefulForClass(item, player.gameClass)), ...accessoryItems], [items, player.gameClass, accessoryItems])
  const armorSlot = useMemo(() => {
    const result = new Map<string, Slot>()
    armorSetsForClass(player.gameClass).forEach(set => set.pieces.forEach(piece => {
      const slot = armorSlotFor(piece.slot)
      if (slot) result.set(piece.name, slot)
    }))
    return result
  }, [player.gameClass])
  const itemFor = (id: string) => classItems.find(item => item.id === id)
  const whipNames = new Set(['Leather Whip', 'Snapthorn', 'Spinal Tap', 'Firecracker', 'Cool Whip', 'Durendal', 'Dark Harvest', 'Morning Star', 'Kaleidoscope'])
  const isWhip = (item: Item) => whipNames.has(item.name) || /whip|кнут|хлыст/i.test([item.name, item.ru, item.category, item.damageType || ''].join(' '))
  const options = (slot: typeof slots[number]) => classItems.filter(item => slot.category === 'whip'
    ? isWhip(item)
    : category(item.category) === slot.category && (slot.category !== 'armor' || armorSlot.get(item.name) === slot.id) && (slot.id !== 'weapon' || player.gameClass !== 'Summoner' || !isWhip(item)))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.name.localeCompare(b.name))
  const visibleOptions = (slot: typeof slots[number]) => options(slot).filter(item => !pickerSearch.trim() || [item.name, item.ru, item.description].join(' ').toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()))
  const equipped = new Set(Object.values(loadout).filter(Boolean))
  const recommendationIds = new Set<string>()
  const recommendations = activeSlots.map(slot => {
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
  const equippedCount = activeSlots.filter(slot => Boolean(loadout[slot.id])).length
  const totalSlots = (player.gameClass === 'Summoner' ? 5 : 4) + accessorySlots

  return <section className="character-loadout-page">
    <header className="character-loadout-header">
      <div><span className="eyebrow">ПЕРСОНАЖ / ЭКИПИРОВКА</span><h2>{player.name}</h2><p>{player.gameClass === 'Melee' ? 'Ближний бой' : player.gameClass === 'Ranger' ? 'Стрелок' : player.gameClass === 'Mage' ? 'Маг' : 'Призыватель'} · Текущие слоты и дальнейшее развитие</p></div>
      <div className="character-progress"><b>{equippedCount}/{totalSlots}</b><span>слотов заполнено</span><div><i style={{ width: (equippedCount / totalSlots * 100) + '%' }}/></div></div>
    </header>
    <div className="character-loadout-grid">
      <section className="character-equipment-panel">
        <div className="character-panel-title"><div><span className="eyebrow">CURRENT LOADOUT</span><h3>Текущая экипировка</h3></div><span>{equippedCount}/{totalSlots} слотов</span></div>
        <div className="terraria-equipment-layout">
          <div className="terraria-equipment-group">
            <div className="terraria-equipment-group-title">Броня</div>
            {activeSlots.filter(slot => slot.category === 'armor').map(slot => {
              const selected = itemFor(loadout[slot.id])
              return <label className="terraria-equipment-slot" key={slot.id}>
                <span className="terraria-slot-label">{slot.label}</span>
                <span className={"terraria-slot-icon" + (selected ? ' is-filled' : '')}>
                  {selected ? <EquipmentIcon item={selected}/> : slot.id === 'head' ? '◈' : slot.id === 'body' ? '▣' : '▤'}
                </span>
                <button type="button" className="terraria-picker-trigger" aria-label={slot.label + ': ' + (selected?.ru || selected?.name || 'Пусто')} aria-expanded={openSlot === slot.id} disabled={disabled} onClick={() => { setOpenSlot(current => current === slot.id ? null : slot.id); setPickerSearch('') }}>
                  <span>{selected ? (selected.ru || selected.name) : 'Выбрать предмет'}</span><span className="terraria-picker-chevron">▾</span>
                </button>
                {openSlot === slot.id && <div className="terraria-item-picker">
                  <input className="terraria-picker-search" type="search" value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} placeholder="Поиск предмета..." aria-label="Поиск предмета"/><button type="button" className="terraria-picker-empty" onClick={() => { setLoadout(current => ({ ...current, [slot.id]: '' })); setOpenSlot(null); setPickerSearch('') }}>Очистить слот</button>
                  <div className="terraria-picker-grid">{visibleOptions(slot).map(item => <button type="button" key={item.id} className={'terraria-picker-item' + (loadout[slot.id] === item.id ? ' selected' : '')} title={item.name} onClick={() => { setLoadout(current => ({ ...current, [slot.id]: item.id })); setOpenSlot(null) }}>
                    <EquipmentIcon item={item}/><span>{item.ru || item.name}</span><small>{stageTitle(player.gameClass, item.stage)}</small>
                  </button>)}</div>
                </div>}
                
              </label>
            })}
          </div>
          <div className="terraria-equipment-group">
            <div className="terraria-equipment-group-title terraria-accessory-heading"><span>Аксессуары</span>
              <div className="terraria-accessory-count" role="group" aria-label="Количество слотов аксессуаров">
                <button type="button" className={accessorySlots === 6 ? 'active' : ''} disabled={disabled} onClick={() => setAccessorySlots(6)}>6</button>
                <button type="button" className={accessorySlots === 7 ? 'active' : ''} disabled={disabled} onClick={() => setAccessorySlots(7)}>7</button>
              </div>
            </div>
            {activeSlots.filter(slot => slot.category === 'accessory').map(slot => {
              const selected = itemFor(loadout[slot.id])
              return <label className="terraria-equipment-slot" key={slot.id}>
                <span className="terraria-slot-label">{slot.label}</span>
                <span className={"terraria-slot-icon" + (selected ? ' is-filled' : '')}>{selected ? <EquipmentIcon item={selected}/> : '◇'}</span>
                <button type="button" className="terraria-picker-trigger" aria-label={slot.label + ': ' + (selected?.ru || selected?.name || 'Пусто')} aria-expanded={openSlot === slot.id} disabled={disabled} onClick={() => setOpenSlot(current => current === slot.id ? null : slot.id)}>
                  <span>{selected ? (selected.ru || selected.name) : 'Выбрать предмет'}</span><span className="terraria-picker-chevron">▾</span>
                </button>
                {openSlot === slot.id && <div className="terraria-item-picker">
                  <input className="terraria-picker-search" type="search" value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} placeholder="Поиск предмета..." aria-label="Поиск предмета"/><button type="button" className="terraria-picker-empty" onClick={() => { setLoadout(current => ({ ...current, [slot.id]: '' })); setOpenSlot(null); setPickerSearch('') }}>Очистить слот</button>
                  <div className="terraria-picker-grid">{visibleOptions(slot).map(item => <button type="button" key={item.id} className={'terraria-picker-item' + (loadout[slot.id] === item.id ? ' selected' : '')} title={item.name} onClick={() => { setLoadout(current => ({ ...current, [slot.id]: item.id })); setOpenSlot(null) }}>
                    <EquipmentIcon item={item}/><span>{item.ru || item.name}</span><small>{stageTitle(player.gameClass, item.stage)}</small>
                  </button>)}</div>
                </div>}
                
              </label>
            })}
          </div>
          <div className="terraria-equipment-group terraria-weapon-group">
            <div className="terraria-equipment-group-title">Оружие</div>
            {activeSlots.filter(slot => slot.id === 'weapon' || slot.id === 'whip').map(slot => {
              const selected = itemFor(loadout[slot.id])
              return <label className="terraria-equipment-slot" key={slot.id}>
                <span className="terraria-slot-label">{slot.label}</span>
                <span className={"terraria-slot-icon" + (selected ? ' is-filled' : '')}>{selected ? <EquipmentIcon item={selected}/> : slot.id === 'whip' ? '〰' : '⚔'}</span>
                <button type="button" className="terraria-picker-trigger" aria-label={slot.label + ': ' + (selected?.ru || selected?.name || 'Пусто')} aria-expanded={openSlot === slot.id} disabled={disabled} onClick={() => setOpenSlot(current => current === slot.id ? null : slot.id)}>
                  <span>{selected ? (selected.ru || selected.name) : 'Выбрать предмет'}</span><span className="terraria-picker-chevron">▾</span>
                </button>
                {openSlot === slot.id && <div className="terraria-item-picker">
                  <input className="terraria-picker-search" type="search" value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} placeholder="Поиск предмета..." aria-label="Поиск предмета"/><button type="button" className="terraria-picker-empty" onClick={() => { setLoadout(current => ({ ...current, [slot.id]: '' })); setOpenSlot(null); setPickerSearch('') }}>Очистить слот</button>
                  <div className="terraria-picker-grid">{visibleOptions(slot).map(item => <button type="button" key={item.id} className={'terraria-picker-item' + (loadout[slot.id] === item.id ? ' selected' : '')} title={item.name} onClick={() => { setLoadout(current => ({ ...current, [slot.id]: item.id })); setOpenSlot(null) }}>
                    <EquipmentIcon item={item}/><span>{item.ru || item.name}</span><small>{stageTitle(player.gameClass, item.stage)}</small>
                  </button>)}</div>
                </div>}
                
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
            <span className="roadmap-node-index">{index + 1}</span><span className="roadmap-node-art"><EquipmentIcon item={item}/></span><div className="roadmap-node-copy"><small>{item.slotLabel} · {stageTitle(player.gameClass, item.stage)}</small><b>{item.ru || item.name}</b><span>{item.name}</span>
              {(item.equipmentEffect || item.buffName || item.description) && <p className="roadmap-node-effect">{item.equipmentEffect || (item.buffName ? item.buffName + (item.buffDuration ? ' · ' + item.buffDuration : '') : item.description)}</p>}
              <button type="button" className="roadmap-craft-button" onClick={() => onOpenCraft(item)}><GitBranch size={13}/> Посмотреть крафт</button>
            </div>
            <span className={"roadmap-node-status status-" + item.status}>{item.status === 'crafting' ? 'В работе' : item.status === 'planned' ? 'В планах' : 'Не получено'}</span>
          </article>)}</div>
        </> : <div className="roadmap-complete"><Shield size={24}/><b>Основные цели закрыты</b><span>Для этого класса пока нет следующих рекомендаций.</span></div>}
        <button className="character-catalog-link" type="button" onClick={onOpenCatalog}>Открыть полный каталог <ArrowRight size={15}/></button>
      </aside>
    </div>
  </section>
}


function EquipmentIcon({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false)
  const src = item.imageUrl ? 'https://wsrv.nl/?url=' + encodeURIComponent(item.imageUrl) : ''
  return src && !failed
    ? <img className="terraria-slot-image" src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>
    : <span>{item.icon || '◇'}</span>
}
