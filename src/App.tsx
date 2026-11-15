import { useMemo, useState } from 'react'
import { Swords, Users, Backpack, Skull, GitBranch, Target, BookOpen, Settings, Globe, Search, ChevronRight, Hammer, Sparkles } from 'lucide-react'
import { items, players, bosses } from './data'
import type { GameClass, ItemStatus } from './types'

type Tab = 'overview' | 'players' | 'progression' | 'inventory' | 'bosses' | 'crafting' | 'catalog'
const nav: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: 'overview', label: 'Обзор мира', icon: Globe },
  { id: 'players', label: 'Игроки', icon: Users },
  { id: 'progression', label: 'Прогресс классов', icon: Swords },
  { id: 'inventory', label: 'Командный инвентарь', icon: Backpack },
  { id: 'bosses', label: 'Боссы и этапы', icon: Skull },
  { id: 'crafting', label: 'Дерево крафта', icon: GitBranch },
  { id: 'catalog', label: 'Каталог предметов', icon: BookOpen },
]
const initial: Record<string, ItemStatus> = {
  night_edge: 'owned', muramasa: 'owned', blade_grass: 'crafting',
  fiery_greatsword: 'missing', terra_blade: 'planned', megashark: 'owned',
  meteor_staff: 'planned', spider_staff: 'missing',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [selected, setSelected] = useState('p1')
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>(() => {
    try { return { ...initial, ...JSON.parse(localStorage.getItem('terraria-statuses') || '{}') } }
    catch { return initial }
  })
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState('terra_blade')
  const player = players.find(p => p.id === selected)!
  const owned = (id: string) => statuses[id] === 'owned'
  const setStatus = (id: string, status: ItemStatus) => {
    const next = { ...statuses, [id]: status }
    setStatuses(next)
    localStorage.setItem('terraria-statuses', JSON.stringify(next))
  }
  const classItems = items.filter(i => i.gameClass.includes(player.gameClass))
  const total = Math.round(
    items.filter(i => i.gameClass.includes(player.gameClass))
      .filter(i => statuses[i.id] !== 'skipped')
      .filter(i => owned(i.id)).length /
    Math.max(items.filter(i => i.gameClass.includes(player.gameClass) && statuses[i.id] !== 'skipped').length, 1) * 100,
  )
  const teamCount = items.filter(i => players.some(p => statuses[`${p.id}:${i.id}`] === 'owned') || owned(i.id)).length
  const filtered = useMemo(() => items.filter(i => (i.name + ' ' + i.ru).toLowerCase().includes(query.toLowerCase())), [query])
  const current = items.find(i => i.id === target)!
  const recipeTree = (id: string, depth = 0, seen: string[] = []): any => {
    const it = items.find(x => x.id === id)
    if (!it) return null
    return {
      it, depth, cycle: seen.includes(id),
      children: it.recipe?.map(r => ({ qty: r.qty, ...recipeTree(r.itemId, depth + 1, [...seen, id]) })).filter(Boolean) || [],
    }
  }
  const tree = recipeTree(target)
  const pageTitle = nav.find(n => n.id === tab)?.label || 'Обзор'

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><div><b>TERRARIA</b><small>PROGRESS TRACKER</small></div></div>
      <div className="world-switch"><span className="eyebrow">ТЕКУЩИЙ МИР</span><b>For The Worthy</b><small>Master · Crimson · 1.4.5.x</small></div>
      <div className="nav-label">ПРИКЛЮЧЕНИЕ</div>
      {nav.map(n => <button key={n.id} className={'nav-item ' + (tab === n.id ? 'active' : '')} onClick={() => setTab(n.id)}>
        <n.icon size={17}/>{n.label}{n.id === 'inventory' || n.id === 'crafting' ? <span className="new-dot"/> : null}
      </button>)}
      <div className="sidebar-bottom">
        <div className="connection"><span className="status-dot"/> DEMO MODE <small>Локальное сохранение</small></div>
        <button className="nav-item"><Settings size={17}/>Настройки</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="crumb">МИРЫ <ChevronRight size={13}/> <b>FOR THE WORTHY</b> <ChevronRight size={13}/> {pageTitle.toUpperCase()}</div>
        <div className="top-actions"><span className="version">VANILLA 1.4.5.x</span><div className="avatar">{player.name[0]}</div><span className="player-name">{player.name}</span></div>
      </header>
      <div className="content">
        <div className="page-heading">
          <div><div className="eyebrow">WORLD OVERVIEW / {pageTitle.toUpperCase()}</div><h1>{tab === 'overview' ? 'Путешествие продолжается' : pageTitle}</h1><p>Отслеживайте прогресс команды и планируйте следующие шаги.</p></div>
          <button className="gold-button" onClick={() => setTab('players')}><Users size={16}/> Игроки мира</button>
        </div>
        {tab === 'overview' && <>
          <section className="hero-panel">
            <div className="hero-copy"><span className="eyebrow gold">АКТИВНОЕ СОХРАНЕНИЕ</span><h2>For The Worthy</h2>
              <p>Master Mode <i/> Crimson <i/> Large World</p>
              <div className="progress-meta"><span>Общий прогресс команды</span><b>38%</b></div>
              <div className="progress-track"><div style={{ width: '38%' }}/></div>
              <div className="hero-stats"><span><b>4</b> игрока</span><span><b>3 / 10</b> этапов</span><span><b>2</b> босса побеждено</span></div>
            </div><div className="pixel-sun">☀</div><div className="hero-ground"/>
          </section>
          <div className="section-title"><h2>Отряд</h2><button className="text-button" onClick={() => setTab('players')}>Все игроки <ChevronRight size={15}/></button></div>
          <div className="player-grid">{players.map(p => {
            const its = items.filter(i => i.gameClass.includes(p.gameClass))
            const done = its.filter(i => statuses[i.id] === 'owned').length
            return <button className={'player-card ' + (selected === p.id ? 'chosen' : '')} key={p.id} onClick={() => { setSelected(p.id); setTab('players') }}>
              <div className="player-top"><div className="player-emblem" style={{ background: p.color }}>{p.gameClass === 'Melee' ? '⚔' : p.gameClass === 'Ranger' ? '➶' : p.gameClass === 'Mage' ? '✦' : '♟'}</div><span className="class-tag">{p.gameClass}</span></div>
              <h3>{p.name}</h3><div className="mini-progress"><span style={{ width: `${Math.round(done / Math.max(its.length, 1) * 100)}%` }}/></div><small>{done} / {its.length} предметов отмечено</small>
            </button>
          })}</div>
          <div className="two-col">
            <section className="panel"><div className="panel-head"><h2>Следующие цели</h2><Target size={17}/></div>
              {items.filter(i => statuses[i.id] === 'planned' || statuses[i.id] === 'crafting').slice(0, 4).map(i =>
                <div className="goal-row" key={i.id}><span className="item-icon">{i.icon}</span><div className="goal-info"><b>{i.name}</b><small>{i.source}</small></div><span className={'state ' + statuses[i.id]}>{statuses[i.id] === 'planned' ? 'В планах' : 'В работе'}</span></div>)}
            </section>
            <section className="panel"><div className="panel-head"><h2>Прогресс боссов</h2><Skull size={17}/></div>
              {bosses.slice(0, 5).map((b, i) => <div className="boss-row" key={b.id}><span className={'boss-icon ' + (i < 2 ? 'defeated' : '')}>{i < 2 ? '✓' : '?'}</span><span>{b.name}</span><small>{i < 2 ? 'Побеждён' : 'Ожидает'}</small></div>)}
            </section>
          </div>
        </>}
        {tab === 'players' && <>
          <div className="player-switch">{players.map(p => <button className={selected === p.id ? 'selected' : ''} onClick={() => setSelected(p.id)} key={p.id}>{p.name}<small>{p.gameClass}</small></button>)}</div>
          <div className="profile-banner"><div className="player-emblem big" style={{ background: player.color }}>{player.gameClass === 'Melee' ? '⚔' : player.gameClass === 'Ranger' ? '➶' : player.gameClass === 'Mage' ? '✦' : '♟'}</div>
            <div><span className="eyebrow">ПЕРСОНАЖ / {player.gameClass.toUpperCase()}</span><h2>{player.name}</h2><p>{player.gameClass} progression · Master Mode</p></div>
            <div className="profile-percent"><b>{total}%</b><small>прогресс класса</small></div>
          </div>
          <div className="section-title"><h2>Предметы персонажа</h2><span className="muted">{classItems.length} в каталоге</span></div>
          <div className="item-grid">{classItems.map(i => <ItemCard key={i.id} item={i} status={statuses[i.id] || 'missing'} onStatus={setStatus}/>)}</div>
        </>}
        {tab === 'progression' && <>
          <div className="class-tabs">{(['Melee', 'Ranger', 'Mage', 'Summoner'] as GameClass[]).map(c =>
            <button className={player.gameClass === c ? 'selected' : ''} onClick={() => { const p = players.find(x => x.gameClass === c)!; setSelected(p.id) }} key={c}>{c}</button>)}</div>
          <div className="stage-list">{['Pre-Boss', 'Pre-Skeletron', 'Pre-Wall of Flesh', 'Pre-Mechanical Bosses', 'Pre-Plantera', 'Pre-Golem', 'Pre-Moon Lord', 'Post-Moon Lord'].map((s, i) =>
            <section className="stage-card" key={s}><div className="stage-number">{String(i + 1).padStart(2, '0')}</div><div className="stage-main"><b>{s}</b><small>{i === 0 ? 'Начальная экипировка и подготовка' : i < 3 ? 'Подготовка к следующему боссу' : 'Развитие экипировки и аксессуаров'}</small></div><span className={i < 2 ? 'stage-open' : 'stage-locked'}>{i < 2 ? 'ДОСТУПЕН' : 'ЗАБЛОКИРОВАН'}</span></section>)}
          </div>
        </>}
        {tab === 'inventory' && <>
          <div className="notice"><Backpack size={18}/> Командный инвентарь в демо-режиме агрегирует отмеченные предметы. Синхронизация между игроками появится после подключения Apps Script.</div>
          <div className="stats-row"><Stat label="Предметов в команде" value={String(teamCount)}/><Stat label="Игроков" value="4"/><Stat label="Активных целей" value={String(items.filter(i => statuses[i.id] === 'planned' || statuses[i.id] === 'crafting').length)}/></div>
          <div className="item-grid">{items.filter(i => statuses[i.id] === 'owned').map(i => <div className="item-card" key={i.id}><div className="item-art">{i.icon}</div><div className="item-details"><b>{i.name}</b><small>{i.gameClass.join(', ')}</small><span className="state owned">Есть в команде</span></div></div>)}</div>
        </>}
        {tab === 'bosses' && <>
          <div className="notice"><Skull size={18}/> Boss Gates: отметка босса открывает последующие этапы. В демо используются примерные связи — перед production их нужно сверить с игровыми условиями 1.4.5.x.</div>
          <div className="boss-grid">{bosses.map((b, i) => <div className="boss-card" key={b.id}><div className={'boss-portrait ' + (i < 2 ? 'won' : '')}>{i < 2 ? '☠' : '?'}</div><div><b>{b.name}</b><small>{b.stage}</small><span className={i < 2 ? 'state owned' : 'state missing'}>{i < 2 ? 'Побеждён' : b.requires.length ? 'Зависит от предыдущего этапа' : 'Доступен'}</span></div><button className="small-button" onClick={e => { e.currentTarget.textContent = e.currentTarget.textContent === 'Отметить' ? 'Отмечен' : 'Отметить' }}>Отметить</button></div>)}</div>
        </>}
        {tab === 'crafting' && <>
          <div className="craft-layout">
            <section className="panel craft-picker"><div className="panel-head"><h2>Целевой предмет</h2><Hammer size={17}/></div>
              {items.filter(i => i.recipe).map(i => <button className={'craft-choice ' + (target === i.id ? 'selected' : '')} onClick={() => setTarget(i.id)} key={i.id}><span>{i.icon}</span><b>{i.name}</b><ChevronRight size={15}/></button>)}
            </section>
            <section className="panel tree-panel"><div className="panel-head"><div><h2>{current.name}</h2><small className="muted">Дерево компонентов · {current.station || 'Способ получения'}</small></div><GitBranch size={18}/></div>
              <div className="tree-root">{tree && <TreeNode node={tree} statuses={statuses}/>}</div>
              <div className="notice compact"><Sparkles size={16}/> Демо-данные: рецепты и количества требуют проверки по Terraria Wiki перед использованием в реальном прохождении.</div>
            </section>
          </div>
        </>}
        {tab === 'catalog' && <>
          <div className="search-bar"><Search size={18}/><input placeholder="Поиск предмета на русском или английском..." value={query} onChange={e => setQuery(e.target.value)}/></div>
          <div className="filter-row"><span>{filtered.length} предметов</span><span>Vanilla · 1.4.5.x</span></div>
          <div className="item-grid">{filtered.map(i => <ItemCard key={i.id} item={i} status={statuses[i.id] || 'missing'} onStatus={setStatus}/>)}</div>
        </>}
        <footer>TERRARIA PROGRESS TRACKER <span>НЕОФИЦИАЛЬНЫЙ ФАН-ПРОЕКТ · ДЕМО-ДАННЫЕ</span></footer>
      </div>
    </main>
  </div>
}

function ItemCard({ item, status, onStatus }: { item: any; status: ItemStatus; onStatus: (id: string, s: ItemStatus) => void }) {
  const labels: Record<ItemStatus, string> = { owned: 'Получен', planned: 'В планах', crafting: 'В работе', missing: 'Не получен', skipped: 'Пропущен' }
  return <article className="item-card"><div className="item-art">{item.icon}</div><div className="item-details"><b>{item.name}</b><small>{item.ru} · {item.stage}</small><small>{item.source}</small><span className={'state ' + status}>{labels[status]}</span></div>
    <select value={status} onChange={e => onStatus(item.id, e.target.value as ItemStatus)} aria-label={'Статус ' + item.name}><option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option></select>
  </article>
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><small>{label}</small><b>{value}</b></div>
}
function TreeNode({ node, statuses }: { node: any; statuses: Record<string, ItemStatus> }) {
  const [open, setOpen] = useState(true)
  return <div className="tree-node"><div className={'tree-item ' + (statuses[node.it.id] === 'owned' ? 'has-item' : '')}>
    <button onClick={() => setOpen(!open)}>{node.children.length ? (open ? '−' : '+') : '·'}</button><span>{node.it.icon}</span><b>{node.it.name}</b><small>{statuses[node.it.id] === 'owned' ? 'Есть' : 'Нужно проверить'}</small>
  </div>{open && node.children.length > 0 && <div className="tree-children">{node.children.map((child: any, i: number) => <div className="tree-branch" key={i}><TreeNode node={child} statuses={statuses}/></div>)}</div>}</div>
}
