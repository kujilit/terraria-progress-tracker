import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Crosshair, FlaskConical, Shield, Sparkles, Swords, Target, Trophy, type LucideIcon } from 'lucide-react'
import { isItemUsefulForClass } from './armor-sets'
import { getItemStageRank } from './gear-progression'
import type { Boss, GameClass, Item, ItemStatus } from './types'
import { Badge, Button, Panel } from './components/ui'
import { ruBoss, ruClass, ruItem, ruStage, ruText } from './localization'

type BossStatus = 'defeated' | 'pending'
type Props = {
  playerName: string
  gameClass: GameClass
  catalog: Item[]
  bosses: Boss[]
  statusForItem: (id: string) => ItemStatus
  onItemStatus: (id: string, status: ItemStatus) => void
  bossStatus: (id: string) => BossStatus
  onBossStatus: (id: string, status: BossStatus) => void
  disabled?: boolean
}

const classNames: Record<GameClass, string> = { Melee: 'Ближний бой', Ranger: 'Стрелок', Mage: 'Маг', Summoner: 'Призыватель' }
const category = (value: string) => {
  const v = value.toLowerCase()
  if (v.includes('weapon') || v.includes('оруж')) return 'weapon'
  if (v.includes('armor') || v.includes('брон')) return 'armor'
  if (v.includes('accessory') || v.includes('аксесс')) return 'accessory'
  if (v.includes('ammo') || v.includes('боеприп')) return 'ammo'
  if (v.includes('material') || v.includes('материал')) return 'material'
  return 'other'
}
const bossPrep: Record<string, { title: string; tasks: string[]; potions: string[] }> = {
  king_slime: { title: 'Слизневый король', tasks: ['Подготовить ровную площадку для манёвров', 'Взять платформы и источник света', 'Проверить запас лечебных зелий'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Любая еда'] },
  queen_bee: { title: 'Охота в улье', tasks: ['Найти улей в подземных джунглях', 'Расчистить пространство для уклонения', 'Подготовить оружие против быстрых целей'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Любая еда'] },
  deerclops: { title: 'Встреча в метели', tasks: ['Дождаться метели в снежном биоме', 'Подготовить арену с пространством для отступления', 'Не подходить близко к атакам по области'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Любая еда'] },
  dreadnautilus: { title: 'Кровавая луна', tasks: ['Начать рыбалку во время Кровавой луны', 'Подготовить арену над водой', 'Взять оружие для уклонения от рывков'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Любая еда'] },
  duke_fishron: { title: 'Морская охота', tasks: ['Подготовить длинную воздушную арену над океаном', 'Использовать приманку трюфельного червя в океане', 'Подготовить мобильность для трёх фаз боя'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Зелье выносливости', 'Любая еда'] },
  empress_of_light: { title: 'Сияющая дуэль', tasks: ['Вызвать Принцессу света в Святых землях ночью', 'Подготовить длинную арену и высокую мобильность', 'Изучить траектории световых атак'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Зелье жизненной силы', 'Любая еда'] },
  eye: { title: 'Ночная охота', tasks: ['Построить арену из платформ в несколько уровней', 'Освободить аксессуары для мобильности', 'Подготовить дальнобойное оружие'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Любая еда'] },
  eater: { title: 'Битва в порче / кримзоне', tasks: ['Подготовить пространство в биоме босса', 'Взять кирку для добычи руды после победы', 'Подготовить оружие по площади'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье ярости или гнева', 'Любая еда'] },
  skeletron: { title: 'Поход в Данж', tasks: ['Построить длинную арену рядом с Данжем', 'Подготовить оружие для рук и головы', 'Проверить мобильность и запас здоровья'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Зелье ярости или гнева'] },
  wof: { title: 'Переход в Hardmode', tasks: ['Построить длинный мост в Аду', 'Подготовить запас блоков и платформ', 'Освободить инвентарь для новых руд', 'Взять оружие с хорошей дальностью'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье скорости', 'Любая еда'] },
  destroyer: { title: 'Охота на Разрушителя', tasks: ['Подготовить высокую арену с платформами', 'Взять оружие с уроном по нескольким сегментам', 'Подготовить защиту от лазеров и зондов'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье жизненной силы', 'Любая еда'] },
  twins: { title: 'Битва с Близнецами', tasks: ['Подготовить длинную арену для постоянного движения', 'Взять оружие с высокой точностью и дальностью', 'Продумать порядок уничтожения Ретинайзера и Спазматизма'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье скорости', 'Зелье выносливости', 'Любая еда'] },
  skeletron_prime: { title: 'Ночь с Скелетроном Праймом', tasks: ['Подготовить просторную арену', 'Взять оружие для быстрого уничтожения конечностей', 'Следить за таймером ночи и не затягивать бой'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье жизненной силы', 'Любая еда'] },
  plantera: { title: 'Сражение в подземных джунглях', tasks: ['Найти большую открытую камеру в джунглях', 'Расчистить арену, не выходя за пределы джунглей', 'Установить сердечные фонари и костры'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье жизненной силы', 'Зелье ярости или гнева'] },
  golem: { title: 'Храм джунглей', tasks: ['Подготовить арену внутри Храма', 'Проверить доступ к алтарю Голема', 'Взять оружие для ближней и дальней дистанции'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье жизненной силы'] },
  cultist: { title: 'Лунные события', tasks: ['Подготовить арену у входа в Данж', 'Убедиться, что экипировка после Голема улучшена', 'Подготовить оружие для быстрого уничтожения клонов'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье жизненной силы', 'Зелье ярости или гнева'] },
  moon_lord: { title: 'Финальная битва', tasks: ['Подготовить длинную арену или маршрут для перемещения', 'Собрать лучшее доступное оружие своего класса', 'Запастись лечебными зельями и расходниками', 'Проверить все аксессуары и их модификаторы'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Зелье выносливости', 'Зелье жизненной силы', 'Зелье ярости или гнева', 'Любая еда'] },
}

const storageKey = (bossId: string) => `terraria-boss-prep:${bossId}`
function readTasks(bossId: string, tasks: string[]) {
  try { return { ...Object.fromEntries(tasks.map(task => [task, false])), ...JSON.parse(localStorage.getItem(storageKey(bossId)) || '{}') } as Record<string, boolean> }
  catch { return Object.fromEntries(tasks.map(task => [task, false])) as Record<string, boolean> }
}

export function ProgressionCompanion({ playerName, gameClass, catalog, bosses, statusForItem, onItemStatus, bossStatus, onBossStatus, disabled = false }: Props) {
  const [section, setSection] = useState<'tree' | 'gear' | 'boss'>('tree')
  const [selectedBoss, setSelectedBoss] = useState('')
  const [taskState, setTaskState] = useState<Record<string, boolean>>({})
  const orderedBosses = useMemo(() => bosses, [bosses])
  const nextBoss = orderedBosses.find(boss => bossStatus(boss.id) !== 'defeated') || orderedBosses[orderedBosses.length - 1]
  const activeBoss = orderedBosses.find(boss => boss.id === selectedBoss) || nextBoss
  const prep = bossPrep[activeBoss?.id || ''] || { title: 'Подготовка к битве', tasks: ['Проверить экипировку', 'Подготовить арену', 'Взять лечебные зелья'], potions: ['Зелье железной кожи', 'Зелье регенерации', 'Любая еда'] }
  useEffect(() => { if (activeBoss) setTaskState(readTasks(activeBoss.id, prep.tasks)) }, [activeBoss?.id])
  const classGear = useMemo(() => catalog.filter(item => isItemUsefulForClass(item, gameClass) && category(item.category) !== 'other' && category(item.category) !== 'ammo' && category(item.category) !== 'material'), [catalog, gameClass])
  const owned = classGear.filter(item => statusForItem(item.id) === 'owned')
  const recommendations = classGear
    .filter(item => !['owned', 'skipped'].includes(statusForItem(item.id)))
    .sort((a, b) => {
      const ar = getItemStageRank(a.stage), br = getItemStageRank(b.stage)
      const aRank = ar < 0 ? 99 : ar, bRank = br < 0 ? 99 : br
      return aRank - bRank || (category(a.category) === 'armor' ? 0 : 1) - (category(b.category) === 'armor' ? 0 : 1) || a.name.localeCompare(b.name)
    })
    .slice(0, 8)
  const toggleTask = (task: string) => {
    const next = { ...taskState, [task]: !taskState[task] }
    setTaskState(next)
    if (activeBoss) localStorage.setItem(storageKey(activeBoss.id), JSON.stringify(next))
  }
  const mainBosses = orderedBosses.filter(boss => !boss.optional)
  const defeatedCount = mainBosses.filter(boss => bossStatus(boss.id) === 'defeated').length
  const tabs: { id: 'tree' | 'gear' | 'boss'; label: string; icon: LucideIcon }[] = [{ id: 'tree', label: 'Прогрессия', icon: Swords }, { id: 'gear', label: 'Экипировка', icon: Shield }, { id: 'boss', label: 'Подготовка к боссу', icon: Crosshair }]
  return <section className="companion-page">
    <header className="companion-hero">
      <div><span className="eyebrow">ПЛАН ПРИКЛЮЧЕНИЯ</span><h2>План приключения</h2><p>{playerName} · {classNames[gameClass]} · персональный маршрут прохождения</p></div>
      <div className="companion-hero-stat"><Trophy size={20}/><b>{defeatedCount}/{mainBosses.length}</b><small>боссов побеждено</small></div>
    </header>
    <nav className="companion-tabs">{tabs.map(tab => <button type="button" key={tab.id} className={section === tab.id ? 'selected' : ''} onClick={() => setSection(tab.id)}><tab.icon size={16}/>{tab.label}</button>)}</nav>

    {section === 'tree' && <div className="companion-tree-layout">
      <section className="companion-tree companion-mainline">
        <div className="companion-line-heading"><span className="eyebrow">ОСНОВНОЕ ПРОХОЖДЕНИЕ</span><h3>Основная линия</h3><p>Обязательные боссы и переходы между этапами.</p></div>
        {orderedBosses.filter(boss => !boss.optional).map((boss, index, list) => {
          const defeated = bossStatus(boss.id) === 'defeated'
          const unlocked = boss.requires.every(required => bossStatus(required) === 'defeated')
          const current = !defeated && unlocked
          return <Panel as="article" className={`companion-boss-node ${defeated ? 'defeated' : current ? 'current' : 'locked'}`} key={boss.id}>
            <div className="companion-node-rail"><span>{defeated ? <Check size={15}/> : index + 1}</span>{index < list.length - 1 && <i/>}</div>
            <div className="companion-node-card">
              <div className="companion-node-copy"><span className="eyebrow">{ruStage(boss.stage)} · ЭТАП {index + 1}</span><h3>{ruBoss(boss.name)}</h3><p>{defeated ? 'Победа зафиксирована' : unlocked ? 'Доступен для сражения' : 'Сначала победите предыдущих боссов'}</p></div>
              <div className="companion-node-actions"><Badge tone={defeated ? 'success' : current ? 'warning' : 'neutral'}>{defeated ? 'Побеждён' : unlocked ? 'Открыт' : 'Закрыт'}</Badge><Button size="sm" variant={defeated ? 'secondary' : 'primary'} disabled={disabled || !unlocked && !defeated} onClick={() => onBossStatus(boss.id, defeated ? 'pending' : 'defeated')}>{defeated ? 'Отменить' : 'Побеждён'}</Button><Button size="sm" variant="ghost" className="companion-detail-button" onClick={() => { setSelectedBoss(boss.id); setSection('boss') }}>Подготовка <ArrowRight size={13}/></Button></div>
            </div>
          </Panel>
        })}
      </section>
      <section className="companion-optional-line">
        <div className="companion-line-heading"><span className="eyebrow">НЕОБЯЗАТЕЛЬНЫЕ ИСПЫТАНИЯ</span><h3>Необязательные боссы</h3><p>Дополнительные испытания. Не блокируют основное прохождение.</p></div>
        <div className="companion-optional-grid">{orderedBosses.filter(boss => boss.optional).map(boss => {
          const defeated = bossStatus(boss.id) === 'defeated'
          const unlocked = boss.requires.every(required => bossStatus(required) === 'defeated')
          return <Panel as="article" className={`companion-boss-node optional ${defeated ? 'defeated' : unlocked ? 'current' : 'locked'}`} key={boss.id}>
            <div className="companion-node-card">
              <div className="companion-node-copy"><span className="eyebrow">{boss.stage} · ДОПОЛНИТЕЛЬНО</span><h3>{boss.name}</h3><p>{defeated ? 'Победа зафиксирована' : unlocked ? 'Можно сразиться в любой момент' : 'Откроется по ходу прохождения'}</p></div>
              <div className="companion-node-actions"><Badge tone={defeated ? 'success' : unlocked ? 'warning' : 'neutral'}>{defeated ? 'Побеждён' : unlocked ? 'Доступен' : 'Позже'}</Badge><Button size="sm" variant={defeated ? 'secondary' : 'primary'} disabled={disabled || !unlocked && !defeated} onClick={() => onBossStatus(boss.id, defeated ? 'pending' : 'defeated')}>{defeated ? 'Отменить' : 'Побеждён'}</Button><Button size="sm" variant="ghost" className="companion-detail-button" onClick={() => { setSelectedBoss(boss.id); setSection('boss') }}>Подготовка <ArrowRight size={13}/></Button></div>
            </div>
          </Panel>
        })}</div>
      </section>
    </div>}

    {section === 'gear' && <div className="companion-gear">
      <div className="companion-section-intro"><div><span className="eyebrow">СОВЕТНИК ПО ЭКИПИРОВКЕ</span><h3>Что улучшить дальше</h3><p>Рекомендации учитывают класс и текущие отметки персонажа. Уже полученные и пропущенные предметы исключены.</p></div><div className="companion-gear-owned"><b>{owned.length}</b><small>предметов получено</small></div></div>
      {recommendations.length ? <div className="companion-recommendations">{recommendations.map((item, index) => <Panel as="article" className="companion-recommendation" key={item.id}>
        <span className="companion-rank">{index + 1}</span><span className="companion-item-icon">{item.icon || '◆'}</span><div className="companion-item-copy"><b>{ruItem(item)}</b><small>{ruItem(item)} · {ruStage(item.stage)} · {ruText(item.category)}</small><p>{item.source || item.description || 'Доступен в текущем каталоге'}</p></div><select value={statusForItem(item.id)} disabled={disabled} onChange={event => onItemStatus(item.id, event.target.value as ItemStatus)} aria-label={`Статус ${item.name}`}><option value="missing">Нет</option><option value="planned">В планах</option><option value="crafting">Собираю</option><option value="owned">Есть</option><option value="skipped">Не нужен</option></select>
      </Panel>)}</div> : <div className="player-gear-empty"><Check size={20}/><b>Нет рекомендаций</b><span>В каталоге не осталось незакрытых предметов для этого класса.</span></div>}
    </div>}

    {section === 'boss' && <div className="companion-boss-prep">
      <div className="companion-section-intro"><div><span className="eyebrow">ПОДГОТОВКА К БОССУ</span><h3>Подготовка к сражению</h3><p>Чек-лист для выбранного босса. Отметки сохраняются в этом браузере.</p></div><Target size={26}/></div>
      <label className="companion-boss-select">Цель<select value={activeBoss?.id || ''} onChange={event => { setSelectedBoss(event.target.value); setTaskState({}) }}>{orderedBosses.map(boss => <option value={boss.id} key={boss.id}>{boss.name}</option>)}</select></label>
      {activeBoss && <><Panel as="div" className="companion-target-card"><div><span className="eyebrow">{ruStage(activeBoss.stage)}</span><h3>{ruBoss(activeBoss.name)}</h3><p>{prep.title}</p></div><Badge tone={bossStatus(activeBoss.id) === 'defeated' ? 'success' : 'warning'}>{bossStatus(activeBoss.id) === 'defeated' ? 'Побеждён' : 'Цель'}</Badge></Panel>
        <section className="companion-checklist"><div className="panel-head"><h3>Тактическая подготовка</h3><b>{prep.tasks.filter(task => taskState[task]).length}/{prep.tasks.length}</b></div>{prep.tasks.map(task => <label className={`companion-check-row ${taskState[task] ? 'checked' : ''}`} key={task}><input type="checkbox" checked={Boolean(taskState[task])} onChange={() => toggleTask(task)}/><span>{task}</span></label>)}</section>
        <section className="companion-checklist"><div className="panel-head"><h3><FlaskConical size={16}/> Расходники и баффы</h3></div>{prep.potions.map(potion => <div className="companion-potion-row" key={potion}><Sparkles size={14}/><span>{potion}</span></div>)}</section>
        <section className="companion-checklist"><div className="panel-head"><h3><Swords size={16}/> Экипировка класса</h3><small>{classNames[gameClass]}</small></div>{classGear.filter(item => statusForItem(item.id) === 'owned').slice(0, 6).map(item => <div className="companion-potion-row" key={item.id}><Check size={14}/><span>{item.ru || item.name}</span><small>{ruText(item.category)}</small></div>)}{!owned.length && <p className="muted">Пока нет отмеченной экипировки. Перейди в рекомендации и обнови статусы.</p>}</section>
      </>}
    </div>}
  </section>
}

