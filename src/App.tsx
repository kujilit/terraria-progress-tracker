import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Swords, Users, Backpack, Skull, GitBranch, Target, BookOpen, Settings, Globe, Search, ChevronRight, Hammer, Sparkles } from 'lucide-react'
import { items, players, bosses } from './data'
import type { GameClass, ItemStatus, Player } from './types'
import type { BossRecord, InventoryRecord, ProgressRecord, TrackerPlayer, TrackerSession } from './services/api'
import { trackerApi, isRemoteMode } from './services'

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
  const [session, setSession] = useState<TrackerSession | null>(() => loadSession())
  const [remotePlayers, setRemotePlayers] = useState<TrackerPlayer[]>([])
  const [remoteProgress, setRemoteProgress] = useState<ProgressRecord[]>([])
  const [remoteBosses, setRemoteBosses] = useState<BossRecord[]>([])
  const [remoteInventory, setRemoteInventory] = useState<InventoryRecord[]>([])
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
  const [target, setTarget] = useState('terra_blade')
  const classColors: Record<GameClass, string> = { Melee:'#d98d54', Ranger:'#79a8d8', Mage:'#a88add', Summoner:'#76b98c' }
  const currentPlayers: Player[] = isRemoteMode
    ? (remotePlayers.length ? remotePlayers : session ? [session.player] : []).map(p => ({...p,color:classColors[p.gameClass]}))
    : players
  const player = currentPlayers.find(p => p.id === selected) || currentPlayers[0] || players[0]
  const owned = (id: string) => statuses[id] === 'owned'
  const setStatus = (id: string, status: ItemStatus) => {
    const next = { ...statuses, [id]: status }
    setStatuses(next)
    if (isRemoteMode && session) {
      trackerApi.setProgress(session.token,{itemId:id,status,quantity:status === 'owned' ? 1 : 0})
        .then(record => setRemoteProgress(current => [...current.filter(x => !(x.playerId === record.playerId && x.itemId === record.itemId)),record]))
        .catch(error => setSyncError(error instanceof Error ? error.message : 'Не удалось сохранить прогресс'))
    } else {
      localStorage.setItem('terraria-statuses', JSON.stringify(next))
      void trackerApi.setProgress(selected,{itemId:id,status,quantity:status === 'owned' ? 1 : 0}).catch(() => undefined)
    }
  }
  useEffect(() => {
    if (!isRemoteMode || !session) return
    let active = true
    setSyncError('')
    Promise.all([
      trackerApi.listPlayers(session.token),
      trackerApi.getProgress(session.token),
      trackerApi.listBosses(session.token),
      trackerApi.listInventory(session.token),
    ]).then(([members, progressRows, bossRows, inventoryRows]) => {
      if (!active) return
      setRemotePlayers(members)
      setRemoteProgress(progressRows)
      setRemoteBosses(bossRows)
      setRemoteInventory(inventoryRows)
      if (!members.some(member => member.id === selected)) setSelected(session.player.id)
    }).catch(error => {
      if (active) setSyncError(error instanceof Error ? error.message : 'Ошибка синхронизации')
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

  const classItems = items.filter(i => i.gameClass.includes(player.gameClass))
  const total = Math.round(
    items.filter(i => i.gameClass.includes(player.gameClass))
      .filter(i => statuses[i.id] !== 'skipped')
      .filter(i => owned(i.id)).length /
    Math.max(items.filter(i => i.gameClass.includes(player.gameClass) && statuses[i.id] !== 'skipped').length, 1) * 100,
  )
  const teamCount = items.filter(i => isRemoteMode ? remoteProgress.some(row => row.itemId === i.id && row.status === 'owned') : (currentPlayers.some(p => statuses[`${p.id}:${i.id}`] === 'owned') || owned(i.id))).length
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
  if (isRemoteMode && !session) return <AuthScreen onSession={handleSession}/>
  
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><div><b>TERRARIA</b><small>PROGRESS TRACKER</small></div></div>
      <div className="world-switch"><span className="eyebrow">ТЕКУЩИЙ МИР</span><b>{session?.world.name || 'For The Worthy'}</b><small>{session ? `${session.world.difficulty} · ${session.world.evilBiome} · ${session.world.gameVersion}` : 'Master · Crimson · 1.4.5.x'}</small></div>
      <div className="nav-label">ПРИКЛЮЧЕНИЕ</div>
      {nav.map(n => <button key={n.id} className={'nav-item ' + (tab === n.id ? 'active' : '')} onClick={() => setTab(n.id)}>
        <n.icon size={17}/>{n.label}{n.id === 'inventory' || n.id === 'crafting' ? <span className="new-dot"/> : null}
      </button>)}
      <div className="sidebar-bottom">
        <div className="connection"><span className="status-dot"/> {isRemoteMode ? 'REMOTE API' : 'DEMO MODE'} <small>{isRemoteMode ? 'Apps Script · синхронизация' : 'Локальное сохранение'}</small></div>
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
              {bosses.slice(0, 5).map((b, i) => <div className="boss-row" key={b.id}><span className={'boss-icon ' + (bossStatus(b.id) === 'defeated' ? 'defeated' : '')}>{bossStatus(b.id) === 'defeated' ? '✓' : '?'}</span><span>{b.name}</span><small>{bossStatus(b.id) === 'defeated' ? 'Побеждён' : 'Ожидает'}</small></div>)}
            </section>
          </div>
        </>}
        {tab === 'players' && <>
          <div className="player-switch">{currentPlayers.map(p => <button className={selected === p.id ? 'selected' : ''} onClick={() => setSelected(p.id)} key={p.id}>{p.name}<small>{p.gameClass}</small></button>)}</div>
          <div className="profile-banner"><div className="player-emblem big" style={{ background: player.color }}>{player.gameClass === 'Melee' ? '⚔' : player.gameClass === 'Ranger' ? '➶' : player.gameClass === 'Mage' ? '✦' : '♟'}</div>
            <div><span className="eyebrow">ПЕРСОНАЖ / {player.gameClass.toUpperCase()}</span><h2>{player.name}</h2><p>{player.gameClass} progression · Master Mode</p></div>
            <div className="profile-percent"><b>{total}%</b><small>прогресс класса</small></div>
          </div>
          <div className="section-title"><h2>Предметы персонажа</h2><span className="muted">{classItems.length} в каталоге</span></div>
          <div className="item-grid">{classItems.map(i => <ItemCard key={i.id} item={i} status={statuses[i.id] || 'missing'} onStatus={setStatus}/>)}</div>
        </>}
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
              <label>Предмет<select value={inventoryItemId} onChange={e=>setInventoryItemId(e.target.value)}>{items.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>Количество<input type="number" min="0" max="99999" value={inventoryQty} onChange={e=>setInventoryQty(e.target.value)}/></label>
              <button className="small-button" onClick={saveInventoryQuantity}>Сохранить у себя</button>
            </div>
            <div className="inventory-form transfer-form">
              <label>Получатель<select value={transferTarget} onChange={e=>setTransferTarget(e.target.value)}><option value="">Выбрать игрока</option>{currentPlayers.filter(p=>p.id!==session.player.id).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
              <label>Количество<input type="number" min="1" max="99999" value={transferQty} onChange={e=>setTransferQty(e.target.value)}/></label>
              <button className="small-button" onClick={transferInventory}>Передать</button>
            </div>
          </section>}
          <div className="notice"><Backpack size={18}/> Командный инвентарь в демо-режиме агрегирует отмеченные предметы. Синхронизация между игроками появится после подключения Apps Script.</div>
          <div className="stats-row"><Stat label="Предметов в команде" value={String(teamCount)}/><Stat label="Игроков" value="4"/><Stat label="Активных целей" value={String(items.filter(i => statuses[i.id] === 'planned' || statuses[i.id] === 'crafting').length)}/></div>
          {isRemoteMode && <div className="item-grid">{remoteInventory.map(row => {
            const item = items.find(x => x.id === row.itemId)
            const owner = currentPlayers.find(x => x.id === row.playerId)
            return <div className="item-card" key={row.id}><div className="item-art">{item?.icon || '📦'}</div><div className="item-details"><b>{item?.name || row.itemId}</b><small>{owner?.name || 'Участник'} · резерв: {row.reservedQuantity}</small><span className="state owned">Количество: {row.quantity}</span></div></div>
          })}</div>}
          {!isRemoteMode && <div className="item-grid">{items.filter(i => statuses[i.id] === 'owned').map(i => <div className="item-card" key={i.id}><div className="item-art">{i.icon}</div><div className="item-details"><b>{i.name}</b><small>{i.gameClass.join(', ')}</small><span className="state owned">Есть в команде</span></div></div>)}</div>}
        </>}
        {tab === 'bosses' && <>
          <div className="notice"><Skull size={18}/> Boss Gates: отметка босса открывает последующие этапы. В демо используются примерные связи — перед production их нужно сверить с игровыми условиями 1.4.5.x.</div>
          <div className="boss-grid">{bosses.map((b, i) => <div className="boss-card" key={b.id}><div className={'boss-portrait ' + (bossStatus(b.id) === 'defeated' ? 'won' : '')}>{bossStatus(b.id) === 'defeated' ? '☠' : '?'}</div><div><b>{b.name}</b><small>{b.stage}</small><span className={bossStatus(b.id) === 'defeated' ? 'state owned' : 'state missing'}>{bossStatus(b.id) === 'defeated' ? 'Побеждён' : b.requires.length ? 'Зависит от предыдущего этапа' : 'Доступен'}</span></div><button className="small-button" onClick={() => setBossStatus(b.id,bossStatus(b.id) === 'defeated' ? 'pending' : 'defeated')}>{bossStatus(b.id) === 'defeated' ? 'Отменить' : 'Отметить'}</button></div>)}</div>
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
