import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Swords, Users, Backpack, Skull, GitBranch, Target, BookOpen, Settings, Globe, Search, ChevronRight, Hammer, Sparkles, Shield, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { AccessoryBuilds } from './AccessoryBuilds'
import { armorPieceEffect, armorSetsForClass, armorSetForItemName, isItemUsefulForClass } from './armor-sets'
import { items, players, bosses } from './data'
import type { GameClass, Item, ItemStatus, Player } from './types'
import type { BossRecord, InventoryRecord, ProgressRecord, TrackerPlayer, TrackerSession } from './services/api'
import { trackerApi, isRemoteMode } from './services'

type Tab = 'overview' | 'players' | 'progression' | 'accessories' | 'inventory' | 'bosses' | 'crafting' | 'catalog'
const nav: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: 'overview', label: 'Обзор мира', icon: Globe },
  { id: 'players', label: 'Игроки', icon: Users },
  { id: 'progression', label: 'Прогресс классов', icon: Swords },
  { id: 'accessories', label: 'Аксессуары и билды', icon: Shield },
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
  const [session, setSession] = useState<TrackerSession | null>(() => loadSession())
  const [remotePlayers, setRemotePlayers] = useState<TrackerPlayer[]>([])
  const [remoteProgress, setRemoteProgress] = useState<ProgressRecord[]>([])
  const [remoteBosses, setRemoteBosses] = useState<BossRecord[]>([])
  const [remoteInventory, setRemoteInventory] = useState<InventoryRecord[]>([])
  const [catalogItems, setCatalogItems] = useState<Item[]>(items)
  const [inventoryItemId, setInventoryItemId] = useState(items[0].id)
  const [inventoryQty, setInventoryQty] = useState('1')
  const [transferTarget, setTransferTarget] = useState('')
  const [transferQty, setTransferQty] = useState('1')
  const [syncError, setSyncError] = useState('')
  const [selected, setSelected] = useState(() => loadSession()?.player.id || 'p1')
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>(() => {
    try { return { ...initial, ...JSON.parse(localStorage.getItem('terraria-statuses') || '{}') } }
    catch { return initial }
  })
  const [query, setQuery] = useState('')
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerCategory, setPlayerCategory] = useState<'all' | 'weapon' | 'armor' | 'accessory' | 'ammo'>('all')
  const [playerStatus, setPlayerStatus] = useState<ItemStatus | 'all'>('all')
  const [playerStage, setPlayerStage] = useState('all')
  const [playerSort, setPlayerSort] = useState<'stage' | 'name' | 'status'>('stage')
  const [playerVisibleCount, setPlayerVisibleCount] = useState(60)
  const [catalogClassFilter, setCatalogClassFilter] = useState<GameClass | 'all'>('all')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all')
  const [catalogStageFilter, setCatalogStageFilter] = useState('all')
  const [catalogStatusFilter, setCatalogStatusFilter] = useState('all')
  const [catalogSort, setCatalogSort] = useState<'name' | 'stage' | 'status'>('name')
  const [target, setTarget] = useState('terra_blade')
  const [recipeIndex, setRecipeIndex] = useState(0)
  const classColors: Record<GameClass, string> = { Melee:'#d98d54', Ranger:'#79a8d8', Mage:'#a88add', Summoner:'#76b98c' }
  const currentPlayers: Player[] = isRemoteMode
    ? (remotePlayers.length ? remotePlayers : session ? [session.player] : []).map(p => ({...p,color:classColors[p.gameClass]}))
    : players
  const player = currentPlayers.find(p => p.id === selected) || currentPlayers[0] || players[0]
  const owned = (id: string) => statuses[id] === 'owned'
  const setStatus = (id: string, status: ItemStatus) => {
    if (isRemoteMode && session && selected !== session.player.id) {
      setSyncError('Можно редактировать только собственный прогресс. Чужой прогресс доступен для просмотра.')
      return
    }
    const previousStatus = statuses[id] || 'missing'
    const next = { ...statuses, [id]: status }
    setStatuses(next)
    if (isRemoteMode && session) {
      trackerApi.setProgress(session.token,{itemId:id,status,quantity:status === 'owned' ? 1 : 0})
        .then(record => setRemoteProgress(current => [...current.filter(x => !(x.playerId === record.playerId && x.itemId === record.itemId)),record]))
        .catch(error => { setStatuses(current => ({...current,[id]:previousStatus})); setSyncError(error instanceof Error ? error.message : 'Не удалось сохранить прогресс') })
    } else {
      localStorage.setItem('terraria-statuses', JSON.stringify(next))
      void trackerApi.setProgress(selected,{itemId:id,status,quantity:status === 'owned' ? 1 : 0}).catch(() => undefined)
    }
  }
  useEffect(() => {
    if (!isRemoteMode || !session) return
    let active = true
    const refresh = async () => {
      try {
        const [members, progressRows, bossRows, inventoryRows] = await Promise.all([
          trackerApi.listPlayers(session.token),
          trackerApi.getProgress(session.token),
          trackerApi.listBosses(session.token),
          trackerApi.listInventory(session.token),
        ])
        if (!active) return
        setRemotePlayers(members)
        setRemoteProgress(progressRows)
        setRemoteBosses(bossRows)
        setRemoteInventory(inventoryRows)
        setSyncError('')
        if (!members.some(member => member.id === selected)) setSelected(session.player.id)
      } catch (error) {
        if (active) setSyncError(error instanceof Error ? error.message : 'Ошибка синхронизации')
      }
    }
    void refresh()
    const intervalId = window.setInterval(() => { void refresh() }, 10000)
    return () => { active = false; window.clearInterval(intervalId) }
  }, [session])
  useEffect(() => {
    if (!isRemoteMode || !session) return
    let active = true
    trackerApi.getCatalog(session.token)
      .then(rows => {
        if (active && rows.length) setCatalogItems(rows)
      })
      .catch(error => {
        if (active) setSyncError(error instanceof Error ? error.message : 'Не удалось загрузить каталог')
      })
    return () => { active = false }
  }, [session])
  useEffect(() => {
    if (!isRemoteMode || !session) return
    const own = remoteProgress.filter(row => row.playerId === selected)
    setStatuses(Object.fromEntries(own.map(row => [row.itemId,row.status])))
  }, [remoteProgress, selected, session])
  const bossStatus = (bossId: string) => {
    if (isRemoteMode) return remoteBosses.find(row => row.bossId === bossId)?.status || 'pending'
    try {
      const saved = JSON.parse(localStorage.getItem('terraria-bosses') || '{}') as Record<string,string>
      return saved[bossId] || (bosses.findIndex(b => b.id === bossId) < 2 ? 'defeated' : 'pending')
    } catch { return bosses.findIndex(b => b.id === bossId) < 2 ? 'defeated' : 'pending' }
  }
  const saveInventoryQuantity = async () => {
    try {
      const row = await trackerApi.setInventory(session?.token || selected,{itemId:inventoryItemId,quantity:Number(inventoryQty)})
      setRemoteInventory(current => [...current.filter(x => !(x.playerId === row.playerId && x.itemId === row.itemId)),row])
      setSyncError('')
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Не удалось сохранить инвентарь') }
  }
  const transferInventory = async () => {
    if (!transferTarget) { setSyncError('Выбери получателя передачи'); return }
    try {
      const result = await trackerApi.transferInventory(session?.token || selected,{
        toPlayerId:transferTarget,itemId:inventoryItemId,quantity:Number(transferQty),idempotencyKey:crypto.randomUUID(),
      })
      const rows = await trackerApi.listInventory(session?.token || selected)
      setRemoteInventory(rows)
      setSyncError(result.duplicate ? 'Этот запрос передачи уже был обработан.' : 'Предметы переданы.')
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Не удалось передать предметы') }
  }
  const setBossStatus = (bossId: string, status: 'defeated'|'pending') => {
    if (isRemoteMode && session) {
      trackerApi.setBossStatus(session.token,{bossId,status})
        .then(row => setRemoteBosses(current => [...current.filter(x => x.bossId !== bossId),row]))
        .catch(error => setSyncError(error instanceof Error ? error.message : 'Не удалось обновить босса'))
    } else {
      const current = JSON.parse(localStorage.getItem('terraria-bosses') || '{}') as Record<string,string>
      current[bossId] = status
      localStorage.setItem('terraria-bosses',JSON.stringify(current))
    }
  }
  const handleSession = (next: TrackerSession) => {
    sessionStorage.setItem('terraria-tracker-session',JSON.stringify(next))
    setSession(next)
    setSelected(next.player.id)
  }
  const handleLogout = async () => {
    if (session) { try { await trackerApi.logout(session.token) } catch { /* local session is still cleared */ } }
    sessionStorage.removeItem('terraria-tracker-session')
    setSession(null); setRemotePlayers([]); setRemoteProgress([]); setRemoteBosses([]); setRemoteInventory([])
  }

  const statusForPlayer = (playerId: string, itemId: string): ItemStatus => {
    if (isRemoteMode) {
      const remoteStatus = remoteProgress.find(row => row.playerId === playerId && row.itemId === itemId)?.status
      if (remoteStatus) return remoteStatus
      return playerId === selected ? (statuses[itemId] || 'missing') : 'missing'
    }
    return statuses[`${playerId}:${itemId}`] || statuses[itemId] || 'missing'
  }
  const classItems = catalogItems.filter(i => categoryKey(i.category) !== 'material' && isItemUsefulForClass(i, player.gameClass))
  const playerStatusCounts = classItems.reduce<Record<ItemStatus, number>>((counts, item) => {
    counts[statusForPlayer(player.id, item.id)] += 1
    return counts
  }, { owned: 0, planned: 0, crafting: 0, missing: 0, skipped: 0 })
  const playerFilteredItems = classItems
    .filter(item => playerCategory === 'all' || categoryKey(item.category) === playerCategory)
    .filter(item => playerStatus === 'all' || statusForPlayer(player.id, item.id) === playerStatus)
    .filter(item => playerStage === 'all' || item.stage === playerStage)
    .filter(item => {
      const setText = armorSetForItemName(item.name, player.gameClass)
        .map(set => [set.name, ...set.bonuses, set.setBonus, set.buffName || ''].join(' '))
        .join(' ')
      const searchable = [
        item.name, item.ru, item.description, item.equipmentEffect, item.armorSetName,
        item.armorSetBonus, item.buffName, item.damageType, item.damage, item.defense, setText,
      ].join(' ').toLowerCase()
      return searchable.includes(playerQuery.trim().toLowerCase())
    })
    .sort((a, b) => {
      if (playerSort === 'name') return a.name.localeCompare(b.name)
      if (playerSort === 'status') {
        const order: Record<ItemStatus, number> = { planned: 0, crafting: 1, missing: 2, owned: 3, skipped: 4 }
        return order[statusForPlayer(player.id, a.id)] - order[statusForPlayer(player.id, b.id)] || a.name.localeCompare(b.name)
      }
      const order: Record<string, number> = { 'Pre-Hardmode': 0, 'Hardmode': 1, 'Post-Mechanical': 2, 'Post-Plantera': 3, 'Post-Golem': 4, 'Post-Moon Lord': 5, 'Not specified': 6 }
      return (order[a.stage] ?? 3) - (order[b.stage] ?? 3) || a.name.localeCompare(b.name)
    })
  const playerArmorSets = armorSetsForClass(player.gameClass)
    .map(set => ({
      set,
      items: set.pieces
        .map(piece => classItems.find(item => item.name === piece.name))
        .filter((item): item is Item => Boolean(item)),
      matched: playerFilteredItems.filter(item => set.pieces.some(piece => piece.name === item.name)).length,
    }))
    .filter(group => group.items.length > 0 && group.matched > 0)
  const groupedArmorNames = new Set(playerArmorSets.flatMap(group => group.items.map(item => item.name)))
  const standalonePlayerItems = playerFilteredItems.filter(item => !groupedArmorNames.has(item.name))
  const visiblePlayerItems = standalonePlayerItems.slice(0, playerVisibleCount)
  const visibleGearCount = visiblePlayerItems.length + playerArmorSets.reduce((sum, group) => sum + group.items.length, 0)
  const categoryCounts = classItems.reduce<Record<string, number>>((counts, item) => {
    const category = categoryKey(item.category)
    counts[category] = (counts[category] || 0) + 1
    return counts
  }, {})
  useEffect(() => { setPlayerVisibleCount(60) }, [selected, playerQuery, playerCategory, playerStatus, playerStage, playerSort])
  const total = Math.round(
    classItems.filter(item => statusForPlayer(player.id, item.id) !== 'skipped' && statusForPlayer(player.id, item.id) === 'owned').length /
    Math.max(classItems.filter(item => statusForPlayer(player.id, item.id) !== 'skipped').length, 1) * 100,
  )
  const teamCount = catalogItems.filter(i => categoryKey(i.category) !== 'material' && (isRemoteMode ? remoteProgress.some(row => row.itemId === i.id && row.status === 'owned') : (currentPlayers.some(p => statuses[`${p.id}:${i.id}`] === 'owned') || owned(i.id)))).length
  const filtered = useMemo(() => {
    const statusOrder: Record<ItemStatus, number> = { planned: 0, crafting: 1, missing: 2, owned: 3, skipped: 4 }
    const stageOrder: Record<string, number> = { 'Pre-Hardmode': 0, 'Hardmode': 1, 'Not specified': 2 }
    return catalogItems
      .filter(item => (item.name + ' ' + item.ru + ' ' + item.description).toLowerCase().includes(query.trim().toLowerCase()))
      .filter(item => catalogClassFilter === 'all' || item.gameClass.includes(catalogClassFilter))
      .filter(item => catalogCategoryFilter === 'all' || categoryKey(item.category) === catalogCategoryFilter)
      .filter(item => catalogStageFilter === 'all' || item.stage === catalogStageFilter)
      .filter(item => catalogStatusFilter === 'all' || (statuses[item.id] || 'missing') === catalogStatusFilter)
      .sort((a, b) => {
        if (catalogSort === 'stage') return (stageOrder[a.stage] ?? 3) - (stageOrder[b.stage] ?? 3) || a.name.localeCompare(b.name)
        if (catalogSort === 'status') return statusOrder[statuses[a.id] || 'missing'] - statusOrder[statuses[b.id] || 'missing'] || a.name.localeCompare(b.name)
        return a.name.localeCompare(b.name)
      })
  }, [catalogItems, query, catalogClassFilter, catalogCategoryFilter, catalogStageFilter, catalogStatusFilter, catalogSort, statuses])
  const catalogFiltersActive = catalogClassFilter !== 'all' || catalogCategoryFilter !== 'all' || catalogStageFilter !== 'all' || catalogStatusFilter !== 'all' || query.trim() !== ''
  const resetCatalogFilters = () => {
    setQuery('')
    setCatalogClassFilter('all')
    setCatalogCategoryFilter('all')
    setCatalogStageFilter('all')
    setCatalogStatusFilter('all')
    setCatalogSort('name')
  }
  const current = catalogItems.find(i => i.id === target) || catalogItems.find(i => i.recipe?.length) || catalogItems[0] || items[0]
  useEffect(() => {
    if (!catalogItems.length) return
    if (!catalogItems.some(item => item.id === target)) {
      setTarget(catalogItems.find(item => item.recipe?.length)?.id || catalogItems[0].id)
    }
    if (!catalogItems.some(item => item.id === inventoryItemId)) {
      setInventoryItemId(catalogItems[0].id)
    }
  }, [catalogItems, target, inventoryItemId])
  const recipeTree = (id: string, depth = 0, seen: string[] = []): any => {
    const it = catalogItems.find(x => x.id === id)
    if (!it || depth > 20) return null
    const cycle = seen.includes(id)
    const recipesForItem = it.recipes || []
    const selectedRecipe = recipesForItem[id === target ? recipeIndex : 0] || recipesForItem[0]
    const ingredients = selectedRecipe?.ingredients || it.recipe || []
    const children = cycle ? [] : ingredients.map(ingredient => {
      const child = recipeTree(ingredient.itemId, depth + 1, [...seen, id])
      return child ? {
        qty: ingredient.qty,
        alternatives: ingredient.alternatives || [],
        ...child,
      } : null
    }).filter(Boolean)
    return {
      it,
      depth,
      cycle,
      station: selectedRecipe?.station || it.station,
      children,
    }
  }
  const tree = current ? recipeTree(current.id) : null
  useEffect(() => { setRecipeIndex(0) }, [target])
  const pageTitle = nav.find(n => n.id === tab)?.label || 'Обзор'
  if (isRemoteMode && !session) return <AuthScreen onSession={handleSession}/>
  
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><div><b>TERRARIA</b><small>PROGRESS TRACKER</small></div></div>
      <div className="world-switch"><span className="eyebrow">ТЕКУЩИЙ МИР</span><b>{session?.world.name || 'For The Worthy'}</b><small>{session ? `${session.world.difficulty} · ${session.world.evilBiome} · ${session.world.gameVersion}` : 'Master · Crimson · 1.4.5.x'}</small>{session && <button className="invite-code" onClick={() => navigator.clipboard.writeText(session.world.joinCode)}>КОД МИРА · {session.world.joinCode}</button>}</div>
      <div className="nav-label">ПРИКЛЮЧЕНИЕ</div>
      {nav.map(n => <button key={n.id} className={'nav-item ' + (tab === n.id ? 'active' : '')} onClick={() => setTab(n.id)}>
        <n.icon size={17}/>{n.label}{n.id === 'inventory' || n.id === 'crafting' ? <span className="new-dot"/> : null}
      </button>)}
      <div className="sidebar-bottom">
        <div className="connection"><span className="status-dot"/> {isRemoteMode ? 'REMOTE API' : 'DEMO MODE'} <small>{isRemoteMode ? 'Supabase · синхронизация' : 'Локальное сохранение'}</small></div>
        <button className="nav-item"><Settings size={17}/>Настройки</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="crumb">МИРЫ <ChevronRight size={13}/> <b>{(session?.world.name || 'FOR THE WORTHY').toUpperCase()}</b> <ChevronRight size={13}/> {pageTitle.toUpperCase()}</div>
        <div className="top-actions"><span className="version">{session?.world.gameVersion || 'VANILLA 1.4.5.x'}</span><div className="avatar">{player.name[0]}</div><span className="player-name">{player.name}</span>{session && <button className="logout-button" onClick={handleLogout}>Выйти</button>}</div>
      </header>
      <div className="content">
        {syncError && <div className="notice sync-error">Синхронизация: {syncError}</div>}
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
          <div className="player-grid">{currentPlayers.map(p => {
            const its = catalogItems.filter(i => i.category !== 'material' && i.gameClass.includes(p.gameClass))
            const done = isRemoteMode ? remoteProgress.filter(row => row.playerId === p.id && row.status === 'owned').length : its.filter(i => statuses[i.id] === 'owned').length
            return <button className={'player-card ' + (selected === p.id ? 'chosen' : '')} key={p.id} onClick={() => { setSelected(p.id); setTab('players') }}>
              <div className="player-top"><div className="player-emblem" style={{ background: p.color }}>{p.gameClass === 'Melee' ? '⚔' : p.gameClass === 'Ranger' ? '➶' : p.gameClass === 'Mage' ? '✦' : '♟'}</div><span className="class-tag">{p.gameClass}</span></div>
              <h3>{p.name}</h3><div className="mini-progress"><span style={{ width: `${Math.round(done / Math.max(its.length, 1) * 100)}%` }}/></div><small>{done} / {its.length} предметов отмечено</small>
            </button>
          })}</div>
          <div className="two-col">
            <section className="panel"><div className="panel-head"><h2>Следующие цели</h2><Target size={17}/></div>
              {catalogItems.filter(i => i.category !== 'material' && (statuses[i.id] === 'planned' || statuses[i.id] === 'crafting')).slice(0, 4).map(i =>
                <div className="goal-row" key={i.id}><ItemArtwork item={i} className="item-icon"/><div className="goal-info"><b>{i.name}</b><small>{i.source}</small></div><span className={'state ' + statuses[i.id]}>{statuses[i.id] === 'planned' ? 'В планах' : 'В работе'}</span></div>)}
            </section>
            <section className="panel"><div className="panel-head"><h2>Прогресс боссов</h2><Skull size={17}/></div>
              {bosses.slice(0, 5).map(b => <div className="boss-row" key={b.id}><span className={'boss-icon ' + (bossStatus(b.id) === 'defeated' ? 'defeated' : '')}>{bossStatus(b.id) === 'defeated' ? '✓' : '?'}</span><span>{b.name}</span><small>{bossStatus(b.id) === 'defeated' ? 'Побеждён' : 'Ожидает'}</small></div>)}
            </section>
          </div>
        </>}
        {tab === 'players' && <>
          <section className="player-roster">
            <div className="player-roster-heading">
              <div><span className="eyebrow">WORLD ROSTER</span><h2>Персонажи мира</h2></div>
              <span>{currentPlayers.length} {currentPlayers.length === 1 ? 'игрок' : 'игрока'}</span>
            </div>
            <div className="player-roster-grid">{currentPlayers.map(p => {
              const gear = catalogItems.filter(item => categoryKey(item.category) !== 'material' && isItemUsefulForClass(item, p.gameClass))
              const collected = gear.filter(item => statusForPlayer(p.id, item.id) === 'owned').length
              const percent = Math.round(collected / Math.max(gear.length, 1) * 100)
              const icon = classIcon(p.gameClass)
              return <button type="button" className={'player-roster-card ' + (selected === p.id ? 'selected' : '')} onClick={() => setSelected(p.id)} key={p.id}>
                <span className="roster-emblem" style={{ background: p.color }}>{icon}</span>
                <span className="roster-identity"><b>{p.name}</b><small>{classLabel(p.gameClass)}</small></span>
                <span className="roster-progress"><b>{percent}%</b><small>{collected}/{gear.length}</small></span>
                <span className="roster-progress-track"><i style={{ width: percent + '%' }}/></span>
              </button>
            })}</div>
          </section>

          <section className="player-profile-panel">
            <div className="player-profile-identity">
              <div className="player-emblem big" style={{ background: player.color }}>{classIcon(player.gameClass)}</div>
              <div><span className="eyebrow">АКТИВНЫЙ ПЕРСОНАЖ</span><h2>{player.name}</h2><p>{classLabel(player.gameClass)} · Master Mode</p></div>
            </div>
            <div className="player-profile-progress">
              <div className="player-profile-progress-head"><span>Прогресс экипировки</span><b>{total}%</b></div>
              <div className="player-profile-track"><i style={{ width: total + '%' }}/></div>
              <small>{playerStatusCounts.owned} из {classItems.length - playerStatusCounts.skipped} предметов получено</small>
            </div>
          </section>

          <div className="player-stat-grid">
            <div><small>Получено</small><b className="stat-owned">{playerStatusCounts.owned}</b></div>
            <div><small>В работе</small><b className="stat-crafting">{playerStatusCounts.crafting}</b></div>
            <div><small>В планах</small><b className="stat-planned">{playerStatusCounts.planned}</b></div>
            <div><small>Не получено</small><b>{playerStatusCounts.missing}</b></div>
          </div>

          <section className="player-gear-section">
            <div className="player-gear-heading">
              <div><span className="eyebrow">LOADOUT / GEAR</span><h2>Экипировка персонажа</h2><p>Предметы подходят классу {classLabel(player.gameClass).toLowerCase()}. Отмечай полученное, запланированное и то, что сейчас собираешь.</p></div>
              <span className="player-gear-total">{playerFilteredItems.length.toLocaleString('ru-RU')} <small>предметов</small></span>
            </div>

            <div className="player-category-tabs">
              {[
                ['all', 'Всё снаряжение', classItems.length],
                ['weapon', 'Оружие', categoryCounts.weapon || 0],
                ['armor', 'Броня', categoryCounts.armor || 0],
                ['accessory', 'Аксессуары', categoryCounts.accessory || 0],
                ['ammo', 'Боеприпасы', categoryCounts.ammo || 0],
              ].map(([key, label, count]) => <button type="button" key={key} className={playerCategory === key ? 'selected' : ''} onClick={() => setPlayerCategory(key as typeof playerCategory)}>
                <span>{label}</span><b>{count}</b>
              </button>)}
            </div>

            <div className="player-gear-filters">
              <div className="player-gear-search"><Search size={16}/><input value={playerQuery} onChange={event => setPlayerQuery(event.target.value)} placeholder="Найти предмет или эффект..."/></div>
              <label><span>Этап</span><select value={playerStage} onChange={event => setPlayerStage(event.target.value)}><option value="all">Все этапы</option><option value="Pre-Hardmode">Pre-Hardmode</option><option value="Hardmode">Hardmode</option><option value="Post-Mechanical">После механических боссов</option><option value="Post-Plantera">После Плантеры</option><option value="Post-Golem">После Голема</option><option value="Post-Moon Lord">После Лунного лорда</option><option value="Not specified">Не указан</option></select></label>
              <label><span>Сортировка</span><select value={playerSort} onChange={event => setPlayerSort(event.target.value as typeof playerSort)}><option value="stage">Сначала ранние этапы</option><option value="name">По названию</option><option value="status">По статусу</option></select></label>
            </div>

            <div className="player-status-filters">
              <span>Показать:</span>
              {[
                ['all', 'Все', classItems.length],
                ['missing', 'Не получено', playerStatusCounts.missing],
                ['planned', 'В планах', playerStatusCounts.planned],
                ['crafting', 'В работе', playerStatusCounts.crafting],
                ['owned', 'Получено', playerStatusCounts.owned],
                ['skipped', 'Пропущено', playerStatusCounts.skipped],
              ].map(([key, label, count]) => <button type="button" key={key} className={playerStatus === key ? 'selected' : ''} onClick={() => setPlayerStatus(key as ItemStatus | 'all')}>
                {label}<b>{count}</b>
              </button>)}
            </div>

            {playerArmorSets.length > 0 && <div className="player-armor-sets">
              <div className="player-armor-set-section-title"><h3>Комплекты брони</h3><span>{playerArmorSets.length} подходящих вариантов</span></div>
              {playerArmorSets.map(({ set, items: setItems, matched }) => <PlayerArmorSetCard
                key={set.id}
                set={set}
                items={setItems}
                matchedCount={matched}
                statusForItem={itemId => statusForPlayer(player.id, itemId)}
                onStatus={setStatus}
                disabled={isRemoteMode && selected !== session?.player.id}
              />)}
            </div>}
            {visiblePlayerItems.length > 0 && <div className="player-gear-grid">
              {visiblePlayerItems.map(item => <PlayerGearCard key={item.id} item={item} status={statusForPlayer(player.id, item.id)} onStatus={setStatus} disabled={isRemoteMode && selected !== session?.player.id}/>)}
            </div>}
            {visibleGearCount === 0 && <div className="player-gear-empty"><Search size={22}/><b>Предметы не найдены</b><span>Попробуй изменить запрос или фильтры.</span><button type="button" onClick={() => { setPlayerQuery(''); setPlayerStage('all'); setPlayerStatus('all'); setPlayerCategory('all') }}>Сбросить фильтры</button></div>}

            <div className="player-gear-pagination">
              <span>Показано {visibleGearCount} · отдельных предметов {visiblePlayerItems.length} из {standalonePlayerItems.length}</span>
              {visiblePlayerItems.length < standalonePlayerItems.length && <button type="button" onClick={() => setPlayerVisibleCount(count => count + 60)}>Показать ещё 60</button>}
            </div>
          </section>
        </>}
        {tab === 'accessories' && <AccessoryBuilds items={catalogItems}/>}
        {tab === 'progression' && <>
          <div className="class-tabs">{(['Melee', 'Ranger', 'Mage', 'Summoner'] as GameClass[]).map(c =>
            <button className={player.gameClass === c ? 'selected' : ''} onClick={() => { const p = currentPlayers.find(x => x.gameClass === c); if (p) setSelected(p.id) }} key={c}>{c}</button>)}</div>
          <div className="stage-list">{['Pre-Boss', 'Pre-Skeletron', 'Pre-Wall of Flesh', 'Pre-Mechanical Bosses', 'Pre-Plantera', 'Pre-Golem', 'Pre-Moon Lord', 'Post-Moon Lord'].map((s, i) =>
            <section className="stage-card" key={s}><div className="stage-number">{String(i + 1).padStart(2, '0')}</div><div className="stage-main"><b>{s}</b><small>{i === 0 ? 'Начальная экипировка и подготовка' : i < 3 ? 'Подготовка к следующему боссу' : 'Развитие экипировки и аксессуаров'}</small></div><span className={i < 2 ? 'stage-open' : 'stage-locked'}>{i < 2 ? 'ДОСТУПЕН' : 'ЗАБЛОКИРОВАН'}</span></section>)}
          </div>
        </>}
        {tab === 'inventory' && <>
          {isRemoteMode && session && <section className="panel inventory-controls">
            <div className="panel-head"><h2>Управление количеством</h2><Backpack size={17}/></div>
            <div className="inventory-form">
              <label>Предмет<select value={inventoryItemId} onChange={e=>setInventoryItemId(e.target.value)}>{catalogItems.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>Количество<input type="number" min="0" max="99999" value={inventoryQty} onChange={e=>setInventoryQty(e.target.value)}/></label>
              <button className="small-button" onClick={saveInventoryQuantity}>Сохранить у себя</button>
            </div>
            <div className="inventory-form transfer-form">
              <label>Получатель<select value={transferTarget} onChange={e=>setTransferTarget(e.target.value)}><option value="">Выбрать игрока</option>{currentPlayers.filter(p=>p.id!==session.player.id).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
              <label>Количество<input type="number" min="1" max="99999" value={transferQty} onChange={e=>setTransferQty(e.target.value)}/></label>
              <button className="small-button" onClick={transferInventory}>Передать</button>
            </div>
          </section>}
          <div className="notice"><Backpack size={18}/> {isRemoteMode ? "Инвентарь синхронизируется через Supabase. Передача работает только в пределах текущего мира." : "В демо-режиме инвентарь показывает предметы, отмеченные как полученные."}</div>
          <div className="stats-row"><Stat label="Предметов в команде" value={String(teamCount)}/><Stat label="Игроков" value={String(currentPlayers.length)}/><Stat label="Активных целей" value={String(catalogItems.filter(i => i.category !== 'material' && (statuses[i.id] === 'planned' || statuses[i.id] === 'crafting')).length)}/></div>
          {isRemoteMode && <div className="item-grid">{remoteInventory.map(row => {
            const item = catalogItems.find(x => x.id === row.itemId)
            const owner = currentPlayers.find(x => x.id === row.playerId)
            return <div className="item-card" key={row.id}><ItemArtwork item={item || { icon: '📦' }} className="item-art"/><div className="item-details"><b>{item?.name || row.itemId}</b><small>{owner?.name || 'Участник'} · резерв: {row.reservedQuantity}</small><span className="state owned">Количество: {row.quantity}</span></div></div>
          })}</div>}
          {!isRemoteMode && <div className="item-grid">{catalogItems.filter(i => i.category !== 'material' && statuses[i.id] === 'owned').map(i => <div className="item-card" key={i.id}><ItemArtwork item={i} className="item-art"/><div className="item-details"><b>{i.name}</b><small>{i.gameClass.join(', ')}</small><span className="state owned">Есть в команде</span></div></div>)}</div>}
        </>}
        {tab === 'bosses' && <>
          <div className="notice"><Skull size={18}/> Boss Gates: отметка босса открывает последующие этапы. В демо используются примерные связи — перед production их нужно сверить с игровыми условиями 1.4.5.x.</div>
          <div className="boss-grid">{bosses.map(b => <div className="boss-card" key={b.id}><div className={'boss-portrait ' + (bossStatus(b.id) === 'defeated' ? 'won' : '')}>{bossStatus(b.id) === 'defeated' ? '☠' : '?'}</div><div><b>{b.name}</b><small>{b.stage}</small><span className={bossStatus(b.id) === 'defeated' ? 'state owned' : 'state missing'}>{bossStatus(b.id) === 'defeated' ? 'Побеждён' : b.requires.length ? 'Зависит от предыдущего этапа' : 'Доступен'}</span></div><button className="small-button" onClick={() => setBossStatus(b.id,bossStatus(b.id) === 'defeated' ? 'pending' : 'defeated')}>{bossStatus(b.id) === 'defeated' ? 'Отменить' : 'Отметить'}</button></div>)}</div>
        </>}
        {tab === 'crafting' && <>
          <div className="craft-layout">
            <section className="panel craft-picker"><div className="panel-head"><h2>Целевой предмет</h2><Hammer size={17}/></div>
              {catalogItems.filter(i => i.category !== 'material' && i.recipe?.length).map(i => <button className={'craft-choice ' + (target === i.id ? 'selected' : '')} onClick={() => setTarget(i.id)} key={i.id}><ItemArtwork item={i} className="craft-choice-art"/><b>{i.name}</b><ChevronRight size={15}/></button>)}
            </section>
            <section className="panel tree-panel"><div className="panel-head"><div><h2>{current?.name || 'Выбери предмет'}</h2><small className="muted">Дерево компонентов · {tree?.station || current?.station || 'Способ получения'}</small></div><GitBranch size={18}/></div>
              {(current?.recipes?.length || 0) > 1 && <label className="recipe-select">Вариант рецепта<select value={recipeIndex} onChange={event => setRecipeIndex(Number(event.target.value))}>{current.recipes?.map((recipe, index) => <option value={index} key={recipe.id}>{recipe.station || 'Без станции'} · {recipe.version || 'Все версии'} · ×{recipe.amount}</option>)}</select></label>}
              <div className="tree-root">{tree && <TreeNode node={tree} statuses={statuses}/>}</div>
              <div className="notice compact"><Sparkles size={16}/> Рецепты загружаются из Terraria Wiki. Проверьте версию игры и доступность конкретного рецепта для вашей платформы.</div>
            </section>
          </div>
        </>}
        {tab === 'catalog' && <>
          <section className="catalog-toolbar">
            <div className="catalog-toolbar-top">
              <div className="catalog-search"><Search size={18}/><input placeholder="Название, описание или эффект предмета..." value={query} onChange={e => setQuery(e.target.value)}/></div>
              <label className="catalog-sort"><span>Сортировка</span><select value={catalogSort} onChange={e => setCatalogSort(e.target.value as 'name' | 'stage' | 'status')}><option value="name">По названию</option><option value="stage">По этапу игры</option><option value="status">По статусу</option></select></label>
            </div>
            <div className="catalog-filter-group">
              <span className="catalog-filter-label"><SlidersHorizontal size={14}/> Класс</span>
              <div className="catalog-filter-chips">
                <button className={catalogClassFilter === 'all' ? 'active' : ''} onClick={() => setCatalogClassFilter('all')}>Все классы</button>
                {(['Melee', 'Ranger', 'Mage', 'Summoner'] as GameClass[]).map(gameClass => <button key={gameClass} className={catalogClassFilter === gameClass ? 'active' : ''} onClick={() => setCatalogClassFilter(gameClass)}>{({Melee:'Ближний бой',Ranger:'Стрелок',Mage:'Маг',Summoner:'Призыватель'})[gameClass]}</button>)}
              </div>
            </div>
            <div className="catalog-filter-group">
              <span className="catalog-filter-label">Тип предмета</span>
              <div className="catalog-filter-chips">
                {[
                  ['all','Все типы'],['weapon','Оружие'],['armor','Броня'],['accessory','Аксессуары'],['ammo','Боеприпасы'],['material','Материалы'],
                ].map(([value,label]) => <button key={value} className={catalogCategoryFilter === value ? 'active' : ''} onClick={() => setCatalogCategoryFilter(value)}>{label}</button>)}
              </div>
            </div>
            <div className="catalog-select-row">
              <label><span>Этап игры</span><select value={catalogStageFilter} onChange={e => setCatalogStageFilter(e.target.value)}><option value="all">Все этапы</option><option value="Pre-Hardmode">Pre-Hardmode</option><option value="Hardmode">Hardmode</option><option value="Not specified">Не указан</option></select></label>
              <label><span>Мой статус</span><select value={catalogStatusFilter} onChange={e => setCatalogStatusFilter(e.target.value)}><option value="all">Любой статус</option><option value="owned">Получен</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Не получен</option><option value="skipped">Пропущен</option></select></label>
              <div className="catalog-results"><b>{filtered.length.toLocaleString('ru-RU')}</b><span>из {catalogItems.length.toLocaleString('ru-RU')} предметов</span></div>
              {catalogFiltersActive && <button className="catalog-reset" onClick={resetCatalogFilters}><RotateCcw size={13}/> Сбросить</button>}
            </div>
          </section>
          {filtered.length
            ? <div className="catalog-grid">{filtered.map(item => <CatalogItemCard key={item.id} item={item} status={statuses[item.id] || 'missing'} onStatus={setStatus} disabled={isRemoteMode && selected !== session?.player.id}/>)}</div>
            : <div className="catalog-empty"><Search size={25}/><b>Ничего не найдено</b><span>Измени запрос или сбрось фильтры.</span><button onClick={resetCatalogFilters}>Сбросить фильтры</button></div>}
        </>}
        <footer>TERRARIA PROGRESS TRACKER <span>НЕОФИЦИАЛЬНЫЙ ФАН-ПРОЕКТ · {isRemoteMode ? "REMOTE DATA" : "DEMO DATA"}</span></footer>
      </div>
    </main>
  </div>
}


function loadSession(): TrackerSession | null {
  try {
    const raw = sessionStorage.getItem('terraria-tracker-session')
    if (!raw) return null
    const value = JSON.parse(raw) as TrackerSession
    if (!value.token || new Date(value.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem('terraria-tracker-session')
      return null
    }
    return value
  } catch { return null }
}

function AuthScreen({ onSession }: { onSession: (session: TrackerSession) => void }) {
  const [mode,setMode] = useState<'login'|'join'|'create'>('login')
  const [joinCode,setJoinCode] = useState('')
  const [worldName,setWorldName] = useState('Новый мир')
  const [playerName,setPlayerName] = useState('')
  const [pin,setPin] = useState('')
  const [gameClass,setGameClass] = useState<GameClass>('Melee')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const session = mode === 'create'
        ? await trackerApi.createWorld({worldName,playerName,pin,gameClass})
        : mode === 'join'
          ? await trackerApi.joinWorld({joinCode,playerName,pin,gameClass})
          : await trackerApi.login({joinCode,playerName,pin})
      onSession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход')
    } finally { setBusy(false) }
  }
  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand auth-brand"><div className="brand-mark">T</div><div><b>TERRARIA</b><small>PROGRESS TRACKER</small></div></div>
    <span className="eyebrow">MULTIPLAYER WORLD ACCESS</span><h1>{mode === 'create' ? 'Создать мир' : mode === 'join' ? 'Присоединиться' : 'Войти в мир'}</h1>
    <div className="auth-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Вход</button><button type="button" className={mode==='join'?'selected':''} onClick={()=>setMode('join')}>Вступить</button><button type="button" className={mode==='create'?'selected':''} onClick={()=>setMode('create')}>Создать</button></div>
    {mode === 'create' ? <label>Название мира<input required minLength={2} maxLength={48} value={worldName} onChange={e=>setWorldName(e.target.value)} /></label> : <label>Код мира<input required minLength={8} maxLength={8} autoCapitalize="characters" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="8 символов" /></label>}
    <label>Имя игрока<input required minLength={2} maxLength={24} value={playerName} onChange={e=>setPlayerName(e.target.value)} /></label>
    <label>PIN (6–12 цифр)<input required inputMode="numeric" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={e=>setPin(e.target.value)} /></label>
    {mode !== 'login' && <label>Класс персонажа<select value={gameClass} onChange={e=>setGameClass(e.target.value as GameClass)}><option>Melee</option><option>Ranger</option><option>Mage</option><option>Summoner</option></select></label>}
    {error && <div className="auth-error">{error}</div>}
    <button className="gold-button auth-submit" disabled={busy}>{busy ? 'Подключение…' : mode === 'create' ? 'Создать мир' : mode === 'join' ? 'Вступить в мир' : 'Войти'}</button>
    <p className="auth-help">Сессия хранится в текущей вкладке браузера и автоматически истекает через 12 часов.</p>
  </form></div>
}

function ItemArtwork({ item, className }: { item: Pick<Item, 'icon' | 'imageUrl'>; className: string }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = item.imageUrl
  return <div className={className} aria-hidden="true">
    {imageUrl && !failed
      ? <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}/>
      : (item.icon || '◆')}
  </div>
}

function classIcon(gameClass: GameClass) {
  return gameClass === 'Melee' ? '⚔' : gameClass === 'Ranger' ? '➶' : gameClass === 'Mage' ? '✦' : '♟'
}

function classLabel(gameClass: GameClass) {
  const labels: Record<GameClass, string> = {
    Melee: 'Ближний бой', Ranger: 'Стрелок', Mage: 'Маг', Summoner: 'Призыватель',
  }
  return labels[gameClass]
}

function PlayerArmorSetCard({ set, items, matchedCount, statusForItem, onStatus, disabled = false }: {
  set: ReturnType<typeof armorSetsForClass>[number]
  items: Item[]
  matchedCount: number
  statusForItem: (itemId: string) => ItemStatus
  onStatus: (id: string, status: ItemStatus) => void
  disabled?: boolean
}) {
  const labels: Record<ItemStatus, string> = {
    owned: 'Получен', planned: 'В планах', crafting: 'В работе',
    missing: 'Не получен', skipped: 'Пропущен',
  }
  const classNames: Record<GameClass, string> = {
    Melee: 'Ближний бой', Ranger: 'Стрелок', Mage: 'Маг', Summoner: 'Призыватель',
  }
  const [expanded, setExpanded] = useState(false)
  return <article className="player-armor-set-card">
    <header className="player-armor-set-head">
      <div>
        <span className="eyebrow">КОМПЛЕКТ БРОНИ · {stageLabel(set.stage)}</span>
        <h3>{set.name}</h3>
        <div className="player-armor-set-classes">{set.classes.map(gameClass => <span key={gameClass}>{classNames[gameClass]}</span>)}</div>
      </div>
      <span className="player-armor-set-count">{items.length}/{set.pieces.length} <small>частей</small></span>
    </header>
    {set.bonuses.length > 0 && <div className="player-armor-bonuses">
      <span className="player-armor-block-label">Суммарные бонусы частей комплекта</span>
      <div>{set.bonuses.map(bonus => <span className="player-armor-bonus" key={bonus}>{bonus}</span>)}</div>
    </div>}
    <div className="player-armor-set-bonus">
      <span className="player-armor-block-label">Особый бонус комплекта</span>
      <p>{set.setBonus}</p>
      {set.buffName && <div className="player-gear-buff"><Sparkles size={13}/> {set.buffName.toLowerCase().includes('дебафф') ? 'Дебафф:' : 'Бафф:'} <b>{set.buffName}</b>{set.buffDuration && <small>{set.buffDuration}</small>}</div>}
    </div>
    <button type="button" className="player-armor-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      <span>{expanded ? 'Скрыть части' : 'Показать части комплекта'}</span>
      <b>{set.pieces.length} предмета</b>
      <ChevronRight className={expanded ? 'expanded' : ''} size={15}/>
    </button>
    {expanded && <div className="player-armor-pieces">
      {set.pieces.map(piece => {
        const item = items.find(entry => entry.name === piece.name)
        if (!item) return <div className="player-armor-piece unavailable" key={piece.name}>
          <span className="player-armor-piece-slot">{piece.slot}</span>
          <b>{piece.name}</b><small>Нет в текущем каталоге</small>
        </div>
        const status = statusForItem(item.id)
        const effect = armorPieceEffect(set, piece.name) || piece.effect || item.equipmentEffect || item.description
        return <div className="player-armor-piece" key={piece.name}>
          <ItemArtwork item={item} className="player-armor-piece-art"/>
          <div className="player-armor-piece-info">
            <span className="player-armor-piece-slot">{piece.slot}</span>
            <b>{item.name}</b>
            {effect && <small>{effect}</small>}
            <span className={'state ' + status}>{labels[status]}</span>
          </div>
          <select value={status} disabled={disabled} onChange={event => onStatus(item.id, event.target.value as ItemStatus)} aria-label={'Статус ' + item.name}>
            <option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option>
          </select>
        </div>
      })}
    </div>}
    {expanded && matchedCount < items.length && <small className="player-armor-filter-note">Показан весь комплект: фильтр совпал с {matchedCount} из {items.length} доступных частей.</small>}
  </article>
}

function PlayerGearCard({ item, status, onStatus, disabled = false }: {
  item: Item
  status: ItemStatus
  onStatus: (id: string, status: ItemStatus) => void
  disabled?: boolean
}) {
  const labels: Record<ItemStatus, string> = {
    owned: 'Получен', planned: 'В планах', crafting: 'В работе',
    missing: 'Не получен', skipped: 'Пропущен',
  }
  return <article className="player-gear-card">
    <ItemArtwork item={item} className="player-gear-art"/>
    <div className="player-gear-main">
      <div className="player-gear-tags"><span>{categoryLabel(item.category)}</span><span>{stageLabel(item.stage)}</span></div>
      <h3>{item.name}</h3>
      {item.ru && item.ru !== item.name && <p className="player-gear-ru">{item.ru}</p>}
      {(item.equipmentEffect || item.description)?.trim() && <p className="player-gear-description">{item.equipmentEffect || item.description}</p>}
      <div className="player-gear-highlights">
        {item.damage !== null && item.damage !== undefined && <span>{item.damage} урона</span>}
        {item.defense !== null && item.defense !== undefined && item.defense > 0 && <span>{item.defense} защиты</span>}
        {item.damageType && <span>{item.damageType}</span>}
        {item.buffName && <span className="player-gear-buff"><Sparkles size={11}/> Эффект: {item.buffName}{item.buffDuration ? ` · ${item.buffDuration}` : ''}</span>}
      </div>
      <small className="player-gear-source">{item.source}</small>
      <div className="player-gear-status">
        <span className={'state ' + status}>{labels[status]}</span>
        <select value={status} disabled={disabled} onChange={event => onStatus(item.id, event.target.value as ItemStatus)} aria-label={'Статус ' + item.name}>
          <option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option>
        </select>
      </div>
    </div>
  </article>
}

function categoryKey(category: string) {
  const value = category.toLowerCase()
  if (value.includes('weapon') || value.includes('оруж')) return 'weapon'
  if (value.includes('armor') || value.includes('брон')) return 'armor'
  if (value.includes('accessory') || value.includes('аксесс')) return 'accessory'
  if (value.includes('ammo') || value.includes('боеприп')) return 'ammo'
  if (value.includes('material') || value.includes('материал')) return 'material'
  return value
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    weapon: 'Оружие', armor: 'Броня', accessory: 'Аксессуар',
    ammo: 'Боеприпасы', material: 'Материал',
  }
  return labels[categoryKey(category)] || category
}

function stageLabel(stage: string) {
  if (stage === 'Pre-Hardmode') return 'Pre-Hardmode'
  if (stage === 'Hardmode') return 'Hardmode'
  if (stage === 'Post-Mechanical') return 'После механических боссов'
  if (stage === 'Post-Plantera') return 'После Плантеры'
  if (stage === 'Post-Golem') return 'После Голема'
  if (stage === 'Post-Moon Lord') return 'После Лунного лорда'
  return 'Этап не указан'
}

function CatalogItemCard({ item, status, onStatus, disabled = false }: {
  item: Item
  status: ItemStatus
  onStatus: (id: string, status: ItemStatus) => void
  disabled?: boolean
}) {
  const labels: Record<ItemStatus, string> = {
    owned: 'Получен', planned: 'В планах', crafting: 'В работе',
    missing: 'Не получен', skipped: 'Пропущен',
  }
  return <article className="catalog-card">
    <div className="catalog-card-top">
      <ItemArtwork item={item} className="catalog-card-art"/>
      <div className="catalog-card-tags"><span>{categoryLabel(item.category)}</span><span>{stageLabel(item.stage)}</span></div>
    </div>
    <div className="catalog-card-body">
      <h3>{item.name}</h3>
      {item.ru && item.ru !== item.name && <p className="catalog-card-ru">{item.ru}</p>}
      {item.description?.trim() && <p className="catalog-card-description">{item.description}</p>}
      <div className="catalog-card-classes">{item.gameClass.map(gameClass => <span key={gameClass}>{({Melee:'Melee',Ranger:'Ranger',Mage:'Mage',Summoner:'Summoner'})[gameClass]}</span>)}</div>
    </div>
    <div className="catalog-card-footer">
      <span className={'state ' + status}>{labels[status]}</span>
      <select value={status} disabled={disabled} onChange={event => onStatus(item.id, event.target.value as ItemStatus)} aria-label={'Статус ' + item.name}>
        <option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option>
      </select>
    </div>
  </article>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><small>{label}</small><b>{value}</b></div>
}
function TreeNode({ node, statuses }: { node: any; statuses: Record<string, ItemStatus> }) {
  const [open, setOpen] = useState(true)
  return <div className="tree-node"><div className={'tree-item ' + (statuses[node.it.id] === 'owned' ? 'has-item' : '')}>
    <button onClick={() => setOpen(!open)}>{node.children.length ? (open ? '−' : '+') : '·'}</button><ItemArtwork item={node.it} className="tree-item-art"/><b>{node.it.name}</b><small>{statuses[node.it.id] === 'owned' ? 'Есть' : 'Нужно проверить'}{node.qty ? ` · ×${node.qty}` : ''}</small>{node.alternatives?.length > 0 && <small>Альтернативы: {node.alternatives.map((option: { name: string }) => option.name).join(' / ')}</small>}
  </div>{open && node.children.length > 0 && <div className="tree-children">{node.children.map((child: any, i: number) => <div className="tree-branch" key={i}><TreeNode node={child} statuses={statuses}/></div>)}</div>}</div>
}
