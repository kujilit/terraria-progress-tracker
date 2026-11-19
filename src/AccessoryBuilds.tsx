import { useMemo, useState } from 'react'
import { ExternalLink, GitBranch, Shield, Sparkles, Swords, Target } from 'lucide-react'
import type { GameClass, Item } from './types'
import { accessoryBuilds, classLabels } from './accessory-builds'
import { Badge, Button, Panel, SectionHeading } from './components/ui'
import { ruItem, ruStage, ruText } from './localization'

const classes: GameClass[] = ['Melee', 'Ranger', 'Mage', 'Summoner']
const classIcons: Record<GameClass, string> = {
  Melee: '⚔',
  Ranger: '➶',
  Mage: '✦',
  Summoner: '♟',
}
const classColors: Record<GameClass, string> = {
  Melee: '#d98d54',
  Ranger: '#79a8d8',
  Mage: '#a88add',
  Summoner: '#76b98c',
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

export function AccessoryBuilds({ items, onOpenCraft }: { items: Item[]; onOpenCraft: (item: Item) => void }) {
  const [selectedClass, setSelectedClass] = useState<GameClass>('Melee')
  const [selectedVariant, setSelectedVariant] = useState('damage')
  const [slotCount, setSlotCount] = useState<6 | 7>(6)
  const variants = accessoryBuilds[selectedClass]
  const build = variants.find(variant => variant.id === selectedVariant) || variants[0]
  const itemIndex = useMemo(
    () => new Map(items.map(item => [normalizeName(item.name), item])),
    [items],
  )
  const chosenItems = build.items.slice(0, slotCount)
  const extraItem = build.items[6]

  const chooseClass = (gameClass: GameClass) => {
    setSelectedClass(gameClass)
    setSelectedVariant(accessoryBuilds[gameClass][0].id)
  }

  return <div className="accessory-page">
    <section className="accessory-intro">
      <SectionHeading
        title="Сборки аксессуаров"
        description="Подборки для четырёх классов: урон, специализация и выживаемость. У каждого предмета показан конкретный эффект, а не просто название."
        className="accessory-intro-heading"
      />
      <div className="accessory-intro-stat">
        <Shield size={19}/>
        <b>1.4.5.8</b>
        <small>актуальная версия</small>
      </div>
    </section>

    <div className="accessory-class-tabs" role="tablist" aria-label="Класс персонажа">
      {classes.map(gameClass => <button
        type="button"
        role="tab"
        aria-selected={selectedClass === gameClass}
        className={selectedClass === gameClass ? 'selected' : ''}
        onClick={() => chooseClass(gameClass)}
        key={gameClass}
      >
        <span className="accessory-class-icon" style={{ background: classColors[gameClass] }}>{classIcons[gameClass]}</span>
        <span>{classLabels[gameClass]}</span>
      </button>)}
    </div>

    <div className="accessory-variant-row">
      {variants.map(variant => <button
        type="button"
        className={build.id === variant.id ? 'selected' : ''}
        onClick={() => setSelectedVariant(variant.id)}
        key={variant.id}
      >
        <span>{variant.label}</span>
        <small>{variant.focus}</small>
      </button>)}
    </div>

    <Panel as="section" className="accessory-build-panel">
      <div className="accessory-build-head">
        <div>
          <span className="eyebrow">РЕКОМЕНДОВАННАЯ СБОРКА</span>
          <h2>{build.label}</h2>
          <p>{build.summary}</p>
        </div>
        <div className="slot-picker">
          <span>Слоты аксессуаров</span>
          <div>
            <Button size="sm" variant={slotCount === 6 ? 'primary' : 'secondary'} className={slotCount === 6 ? 'selected' : ''} onClick={() => setSlotCount(6)}>6</Button>
            <Button size="sm" variant={slotCount === 7 ? 'primary' : 'secondary'} className={slotCount === 7 ? 'selected' : ''} onClick={() => setSlotCount(7)}>7</Button>
          </div>
          <small>{slotCount === 6 ? 'Режим мастера без Сердца демона' : 'Режим мастера + Сердце демона'}</small>
        </div>
      </div>

      <div className="accessory-list">
        {chosenItems.map((accessory, index) => {
          const catalogItem = itemIndex.get(normalizeName(accessory.name))
          const wikiUrl = 'https://terraria.wiki.gg/wiki/' + encodeURIComponent(accessory.name.replace(/ /g, '_'))
          return <Panel as="article" className="accessory-card" key={accessory.name}>
            <div className="accessory-slot">{index + 1}</div>
            <div className="accessory-art">
              {catalogItem?.imageUrl
                ? <img src={catalogItem.imageUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.display = 'none' }}/>
                : <span>{catalogItem?.icon || '◇'}</span>}
            </div>
            <div className="accessory-details">
              <div className="accessory-name-row">
                <h3>{catalogItem ? <button type="button" className="item-recipe-link" onClick={() => onOpenCraft(catalogItem)} title="Открыть дерево крафта">{catalogItem ? ruItem(catalogItem) : accessory.ru}<GitBranch size={13}/></button> : ruText(accessory.name)}</h3>
                <Badge tone="info" className="accessory-role">{ruText(accessory.role)}</Badge>
              </div>
              <p>{accessory.effect}</p>
              <div className="accessory-meta">
                <span>{ruStage(accessory.stage)}</span>
                <a href={wikiUrl} target="_blank" rel="noreferrer">Вики Terraria <ExternalLink size={12}/></a>
              </div>
            </div>
          </Panel>
        })}
      </div>

      {slotCount === 6 && extraItem && <div className="accessory-seventh-slot">
        <div className="accessory-slot">7</div>
        <div>
          <b>Дополнительный слот — после использования Сердце демона</b>
          <p><strong>{itemIndex.get(normalizeName(extraItem.name)) ? <button type="button" className="item-recipe-link" onClick={() => onOpenCraft(itemIndex.get(normalizeName(extraItem.name))!)}>{ruText(extraItem.name)}<GitBranch size={12}/></button> : ruText(extraItem.name)}:</strong> {extraItem.effect}</p>
        </div>
        <Sparkles size={17}/>
      </div>}
    </Panel>

    <div className="accessory-notes">
      <div><Target size={17}/><span>Сборки ориентированы на позднюю игру и бои с боссами. Для ранних этапов меняй недоступные аксессуары на аналоги с тем же назначением.</span></div>
      <div><Swords size={17}/><span>Бонусы аксессуаров не всегда складываются с эффектами их компонентов. У призывателя скорость ближнего боя ускоряет кнуты, но бонусы к урону ближнего боя сами по себе урон кнутов не повышают.</span></div>
      <a href="https://terraria.wiki.gg/wiki/Class_Loadouts" target="_blank" rel="noreferrer">Открыть руководство по классам на Terraria Wiki <ExternalLink size={13}/></a>
    </div>
  </div>
}
