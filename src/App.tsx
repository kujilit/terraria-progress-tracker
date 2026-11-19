import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Swords, Users, Backpack, Skull, GitBranch, BookOpen, Settings, Search, ChevronRight, Hammer, Sparkles, SlidersHorizontal, RotateCcw, Menu, X, ClipboardList, Plus, Trash2, FlaskConical } from 'lucide-react'
import { AccessoryBuilds } from './AccessoryBuilds'
import { ProgressionCompanion } from './ProgressionCompanion'
import { CharacterLoadout } from './CharacterLoadout'
import { armorPieceEffect, armorSetsForClass } from './armor-sets'
import { getClassProgressItems, getItemStageRank } from './gear-progression'
import { itemsWithProgression as items, players, bosses } from './data'
import { classStages } from './class-progression'
import type { GameClass, Item, ItemStatus, Player } from './types'
import type { BossRecord, InventoryRecord, ProgressRecord, TeamNote, TrackerPlayer, TrackerSession } from './services/api'
import { trackerApi, isRemoteMode } from './services'
import { PixelAvatar } from './components/PixelAvatar'
import { Badge, Button, Panel, SectionHeading, StatCard } from './components/ui'
import { PotionItemIcon } from './components/PotionItemIcon'

type Tab = 'players' | 'companion' | 'progression' | 'accessories' | 'inventory' | 'bosses' | 'crafting' | 'catalog' | 'alchemy' | 'notes' | 'settings' | 'admin'
const nav: { id: Tab; label: string; icon: typeof Swords; tabs: Tab[] }[] = [
  { id: 'players', label: 'Мир и игроки', icon: Users, tabs: ['players'] },
  { id: 'progression', label: 'Экипировка', icon: Swords, tabs: ['progression', 'accessories'] },
  { id: 'companion', label: 'План приключения', icon: Skull, tabs: ['companion'] },
  { id: 'crafting', label: 'Крафт', icon: GitBranch, tabs: ['crafting', 'catalog', 'alchemy'] },
  { id: 'notes', label: 'Команда', icon: ClipboardList, tabs: ['notes', 'inventory'] },
]
const subnav: Partial<Record<Tab, { id: Tab; label: string }[]>> = {
  progression: [{ id: 'progression', label: 'Прогресс классов' }, { id: 'accessories', label: 'Аксессуары и билды' }],
  crafting: [{ id: 'crafting', label: 'Дерево крафта' }, { id: 'catalog', label: 'Каталог' }, { id: 'alchemy', label: 'Зелья' }],
  notes: [{ id: 'notes', label: 'Заметки' }, { id: 'inventory', label: 'Инвентарь команды' }],
}
const potionIngredientImages: Record<string, string> = {
  'Бутылка воды': 'water_bottle',
  'Лилейник': 'daybloom',
  'Железная руда или свинцовая руда': 'iron_ore',
  'Гриб': 'mushroom',
  'Миражник': 'blinkroot',
  'Кактус': 'cactus',
  'Бронированная пещерная рыба': 'armored_cavefish',
  'Призмит': 'prismite',
  'Лунное сияние': 'moonglow',
  'Морозный цветок': 'shiverthorn',
  'Воднолист': 'waterleaf',
  'Мертвецвет': 'deathweed',
  'Кровавая пиранья': 'hemopiranha',
  'Эбонкой': 'ebonkoi',
  'Пёстрая жирная рыба': 'variegated_lardfish',
  'Линза': 'lens',
  '2 малых зелья маны': 'lesser_mana_potion',
  'Светящийся гриб': 'glowing_mushroom',
  '10 паутины': 'cobweb',
  'Челюсть муравьиного льва': 'antlion_mandible',
}
const potionImageFiles: Record<string, string> = {
  'Зелье железной кожи': 'ironskin_potion',
  'Зелье регенерации': 'regeneration_potion',
  'Зелье скорости': 'swiftness_potion',
  'Зелье выносливости': 'endurance_potion',
  'Зелье жизненной силы': 'lifeforce_potion',
  'Зелье ярости': 'rage_potion',
  'Зелье гнева': 'wrath_potion',
  'Зелье призыва': 'summoning_potion',
  'Зелье лучника': 'archery_potion',
  'Зелье маны': 'mana_potion',
  'Зелье опасности': 'dangersense_potion',
  'Зелье шахтёра': 'mining_potion',
}

const potionRecipes = [
 {name:'Зелье железной кожи',group:'Защита',effect:'+8 защиты на время действия',ingredients:['Бутылка воды','Лилейник','Железная руда или свинцовая руда'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье регенерации',group:'Защита',effect:'Ускоряет восстановление здоровья',ingredients:['Бутылка воды','Лилейник','Гриб'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье скорости',group:'Исследование',effect:'Увеличивает скорость передвижения',ingredients:['Бутылка воды','Миражник','Кактус'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье выносливости',group:'Защита',effect:'Снижает получаемый урон на 10%',ingredients:['Бутылка воды','Миражник','Бронированная пещерная рыба'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье жизненной силы',group:'Защита',effect:'Увеличивает максимальное здоровье на 20%',ingredients:['Бутылка воды','Призмит','Лунное сияние','Морозный цветок','Воднолист'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье ярости',group:'Бой',effect:'Увеличивает шанс критического удара на 10%',ingredients:['Бутылка воды','Мертвецвет','Кровавая пиранья'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье гнева',group:'Бой',effect:'Увеличивает наносимый урон на 10%',ingredients:['Бутылка воды','Мертвецвет','Эбонкой'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье призыва',group:'Бой',effect:'Увеличивает максимальное число миньонов на 1',ingredients:['Бутылка воды','Лунное сияние','Пёстрая жирная рыба'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье лучника',group:'Бой',effect:'Увеличивает скорость и урон стрел',ingredients:['Бутылка воды','Лилейник','Линза'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье маны',group:'Магия',effect:'Восстанавливает 100 единиц маны',ingredients:['2 малых зелья маны','Светящийся гриб'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье опасности',group:'Исследование',effect:'Подсвечивает опасные объекты поблизости',ingredients:['Бутылка воды','Морозный цветок','10 паутины'],amount:'1',station:'Бутылка / Алхимический стол'},
 {name:'Зелье шахтёра',group:'Исследование',effect:'Увеличивает скорость добычи',ingredients:['Бутылка воды','Миражник','Челюсть муравьиного льва'],amount:'1',station:'Бутылка / Алхимический стол'},
] as const

const initial: Record<string, ItemStatus> = {
  night_edge: 'owned', muramasa: 'owned', blade_grass: 'crafting',
  fiery_greatsword: 'missing', terra_blade: 'planned', megashark: 'owned',
  meteor_staff: 'planned', spider_staff: 'missing',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('players')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [session, setSession] = useState<TrackerSession | null>(() => loadSession())
  const [remotePlayers, setRemotePlayers] = useState<TrackerPlayer[]>([])
  const [remoteProgress, setRemoteProgress] = useState<ProgressRecord[]>([])
  const [remoteBosses, setRemoteBosses] = useState<BossRecord[]>([])
  const [remoteInventory, setRemoteInventory] = useState<InventoryRecord[]>([])
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>([])
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteStatus, setNoteStatus] = useState<TeamNote['status']>('backlog')
  const [notePriority, setNotePriority] = useState<TeamNote['priority']>('normal')
  const [notePlayers, setNotePlayers] = useState<string[]>([])
  const [editingNote, setEditingNote] = useState<string | undefined>()
  const [noteFilter, setNoteFilter] = useState<'all' | TeamNote['status']>('all')
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
  const [hideWeakerGear, setHideWeakerGear] = useState(() => localStorage.getItem('terraria-hide-weaker-gear') === 'true')
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('terraria-compact-mode') === 'true')
  const [animationsEnabled, setAnimationsEnabled] = useState(() => localStorage.getItem('terraria-animations') !== 'false')
  const [uiScale, setUiScale] = useState(() => Number(localStorage.getItem('terraria-ui-scale') || 100))
  const [catalogClassFilter, setCatalogClassFilter] = useState<GameClass | 'all'>('all')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all')
  const [catalogStageFilter, setCatalogStageFilter] = useState('all')
  const [catalogStatusFilter, setCatalogStatusFilter] = useState('all')
  const [catalogSort, setCatalogSort] = useState<'name' | 'stage' | 'status'>('name')
  const [target, setTarget] = useState('terra_blade')
  const [craftQuery, setCraftQuery] = useState('')
  const [recipeIndex, setRecipeIndex] = useState(0)
  const [craftModalItem, setCraftModalItem] = useState<Item | null>(null)
  const [currentLoadouts, setCurrentLoadouts] = useState<Record<string,string>>(() => { try { return JSON.parse(localStorage.getItem('terraria-current-loadouts') || '{}') } catch { return {} } })
  const [currentStages, setCurrentStages] = useState<Record<string,string>>(() => { try { return JSON.parse(localStorage.getItem('terraria-current-stages') || '{}') } catch { return {} } })
  const [potionQuery, setPotionQuery] = useState('')
  const [potionFilter, setPotionFilter] = useState('Все')
  const classColors: Record<GameClass, string> = { Melee:'#d98d54', Ranger:'#79a8d8', Mage:'#a88add', Summoner:'#76b98c' }
  const currentPlayers: Player[] = isRemoteMode
    ? (remotePlayers.length ? remotePlayers : session ? [session.player] : []).map(p => ({...p,color:classColors[p.gameClass]}))
    : players
  const player = currentPlayers.find(p => p.id === selected) || currentPlayers[0] || players[0]
  useEffect(() => { localStorage.setItem('terraria-hide-weaker-gear', String(hideWeakerGear)) }, [hideWeakerGear])
  useEffect(() => { localStorage.setItem('terraria-compact-mode', String(compactMode)) }, [compactMode])
  useEffect(() => { localStorage.setItem('terraria-animations', String(animationsEnabled)) }, [animationsEnabled])
  useEffect(() => { localStorage.setItem('terraria-ui-scale', String(uiScale)) }, [uiScale])
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
    if (isRemoteMode || !session) return
    trackerApi.listPlayers(session.token).then(setRemotePlayers).catch(() => undefined)
  }, [session])
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
        const ownMember = members.find(member => member.id === session.player.id)
        if (ownMember && ownMember.role !== session.player.role) {
          const updatedSession = { ...session, player: ownMember }
          sessionStorage.setItem('terraria-tracker-session', JSON.stringify(updatedSession))
          setSession(updatedSession)
        }
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
    if (isRemoteMode && !session) return
    let active = true
    const token = session?.token || selected
    const refresh = () => trackerApi.listNotes(token).then(rows => { if (active) setTeamNotes(rows) }).catch(error => { if (active) setSyncError(error instanceof Error ? error.message : 'Не удалось загрузить заметки') })
    void refresh()
    if (!isRemoteMode) return () => { active = false }
    const timer = window.setInterval(refresh, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [session, selected])
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
  const nextBoss = bosses.find(boss => bossStatus(boss.id) !== 'defeated')
  const bossWikiSprites: Record<string, string[]> = {
    king_slime: ['King Slime.gif'],
    eye: ['Eye of Cthulhu.gif'],
    eater: ['Eater of Worlds Head.png'],
    skeletron: ['Skeletron Head.png'],
    wof: ['Wall of Flesh.gif'],
    mechs: ['Retinazer (first form).gif', 'Spazmatism (first form).gif', 'Skeletron Prime head.gif'],
    plantera: ['Plantera.gif'],
    golem: ['Golem.png'],
    cultist: ['Lunatic Cultist.png'],
    moon_lord: ['Moon Lord.png'],
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
  const removeWorldPlayer = async (player: TrackerPlayer) => {
    if (!session || !canSeeAdmin || player.id === session.player.id || player.role === 'owner') return
    const confirmed = window.confirm(`Исключить игрока «${player.name}» из мира? Его активные сессии будут завершены.`)
    if (!confirmed) return
    try {
      await trackerApi.removePlayer(session.token, player.id)
      setRemotePlayers(current => current.filter(member => member.id !== player.id))
      setRemoteProgress(current => current.filter(record => record.playerId !== player.id))
      setRemoteInventory(current => current.filter(record => record.playerId !== player.id))
      setSyncError('')
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Не удалось исключить игрока') }
  }
  const changePlayerAdmin = async (playerId: string, isAdmin: boolean) => {
    if (!session || !canManageAdmins) return
    try {
      const updated = await trackerApi.setPlayerAdmin(session.token, playerId, isAdmin)
      setRemotePlayers(current => current.map(member => member.id === updated.id ? updated : member))
      setSyncError('')
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Не удалось изменить роль игрока') }
  }
  const resetNoteForm = () => { setNoteTitle(''); setNoteBody(''); setNoteStatus('backlog'); setNotePriority('normal'); setNotePlayers([]); setEditingNote(undefined) }
  const editNote = (note: TeamNote) => { setEditingNote(note.id); setNoteTitle(note.title); setNoteBody(note.body); setNoteStatus(note.status); setNotePriority(note.priority); setNotePlayers(note.playerIds) }
  const noteToken = session?.token || selected
  const saveTeamNote = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if ((isRemoteMode && !session) || !noteTitle.trim()) return; try { const saved=await trackerApi.saveNote(noteToken,{id:editingNote,title:noteTitle,body:noteBody,status:noteStatus,priority:notePriority,playerIds:notePlayers}); setTeamNotes(current=>[...current.filter(note=>note.id!==saved.id),saved]); resetNoteForm(); setSyncError('') } catch(error) { setSyncError(error instanceof Error?error.message:'Не удалось сохранить заметку') } }
  const deleteTeamNote = async (id:string) => { if((isRemoteMode && !session) || !window.confirm('Удалить заметку?')) return; try { await trackerApi.deleteNote(noteToken,id); setTeamNotes(current=>current.filter(note=>note.id!==id)); if(editingNote===id) resetNoteForm() } catch(error) { setSyncError(error instanceof Error?error.message:'Не удалось удалить заметку') } }
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
  const currentSetId = currentLoadouts[player.id] || ''
  const currentSet = armorSetsForClass(player.gameClass).find(set => set.id === currentSetId)
  const setOwnedPieces = currentSet?.pieces.filter(piece => classItems.some(item => item.name === piece.name && statusForPlayer(player.id,item.id) === 'owned')).length || 0
  const setOptions = armorSetsForClass(player.gameClass).filter(set => classItems.some(item => set.pieces.some(piece => piece.name === item.name)))
  const setCurrentSet = (value:string) => { const next={...currentLoadouts,[player.id]:value}; setCurrentLoadouts(next); localStorage.setItem('terraria-current-loadouts',JSON.stringify(next)) }
  const stageCurrent = currentStages[player.id] || progressionStageGroups[0]?.stage || ''
  const setStageCurrent = (value:string) => { const next={...currentStages,[player.id]:value}; setCurrentStages(next); localStorage.setItem('terraria-current-stages',JSON.stringify(next)) }
  const teamCount = catalogItems.filter(i => categoryKey(i.category) !== 'material' && (isRemoteMode ? remoteProgress.some(row => row.itemId === i.id && row.status === 'owned') : (currentPlayers.some(p => statuses[`${p.id}:${i.id}`] === 'owned') || owned(i.id)))).length
  const filtered = useMemo(() => {
    const statusOrder: Record<ItemStatus, number> = { planned: 0, crafting: 1, missing: 2, owned: 3, skipped: 4 }
    const stageOrder: Record<string, number> = { 'Pre-Hardmode': 0, 'Hardmode': 1, 'Not specified': 2 }
    return catalogItems
      .filter(item => (item.name + ' ' + item.ru + ' ' + cleanWikiText(item.description)).toLowerCase().includes(query.trim().toLowerCase()))
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
  const tree = current ? buildRecipeTree(current.id, catalogItems, recipeIndex) : null
  useEffect(() => { setRecipeIndex(0) }, [target])
  const canSeeAdmin = Boolean(session && (session.player.role === 'owner' || session.player.role === 'admin'))
  const canManageAdmins = Boolean(session?.player.role === 'owner')
  const activeGroup = nav.find(group => group.tabs.includes(tab))
  const activeSubnav = activeGroup ? subnav[activeGroup.id] : undefined
  const pageTitle = tab === 'settings' ? 'Настройки' : tab === 'admin' ? 'Администрирование' : activeSubnav?.find((entry: { id: Tab; label: string }) => entry.id === tab)?.label || activeGroup?.label || 'Игроки'
  const exportProgress = () => {
    const payload = {
      format: 'terraria-progress-tracker', version: 1, exportedAt: new Date().toISOString(),
      statuses, bosses: JSON.parse(localStorage.getItem('terraria-bosses') || '{}'),
      preferences: { hideWeakerGear, compactMode, animationsEnabled, uiScale },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'terraria-progress-backup.json'; link.click()
    URL.revokeObjectURL(url)
  }
  const importProgress = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isRemoteMode) { setSyncError('Импорт локальных резервных копий доступен только в демо-режиме.'); event.target.value = ''; return }
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      if (payload.format !== 'terraria-progress-tracker' || payload.version !== 1 || !payload.statuses || typeof payload.statuses !== 'object') {
        throw new Error('Файл не является резервной копией Terraria Progress Tracker.')
      }
      if (!window.confirm('Импорт заменит текущие статусы предметов и отметки боссов. Продолжить?')) return
      setStatuses(payload.statuses as Record<string, ItemStatus>)
      localStorage.setItem('terraria-statuses', JSON.stringify(payload.statuses))
      const bossData = payload.bosses && typeof payload.bosses === 'object' ? payload.bosses : {}
      localStorage.setItem('terraria-bosses', JSON.stringify(bossData))
      if (payload.preferences) {
        if (typeof payload.preferences.hideWeakerGear === 'boolean') setHideWeakerGear(payload.preferences.hideWeakerGear)
        if (typeof payload.preferences.compactMode === 'boolean') setCompactMode(payload.preferences.compactMode)
        if (typeof payload.preferences.animationsEnabled === 'boolean') setAnimationsEnabled(payload.preferences.animationsEnabled)
        if (Number.isFinite(payload.preferences.uiScale)) setUiScale(Math.min(110, Math.max(90, Number(payload.preferences.uiScale))))
      }
      setSyncError('Резервная копия успешно импортирована.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Не удалось прочитать файл.')
    } finally { event.target.value = '' }
  }
  const resetProgress = () => {
    if (isRemoteMode) return
    if (!window.confirm('Сбросить весь локальный прогресс предметов и боссов? Это действие нельзя отменить.')) return
    setStatuses({})
    localStorage.removeItem('terraria-statuses')
    localStorage.removeItem('terraria-bosses')
    setSyncError('Локальный прогресс сброшен.')
  }
  if (isRemoteMode && !session) return <AuthScreen onSession={handleSession}/>
  
  return <div className="app-root">
    <div className={'app-shell ' + (compactMode ? 'ui-compact ' : '') + (!animationsEnabled ? 'ui-no-animations' : '')} style={{ fontSize: `${uiScale}%` }}>
    <aside className={"sidebar " + (mobileNavOpen ? "mobile-nav-open" : "")}>
      <div className="sidebar-header">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" role="img">
          <path d="M8 29 26 11l4 4L12 33z" fill="#f5e3bb" stroke="#123c49" strokeWidth="2.5"/>
          <path d="m21 10 6-6 10 10-6 6z" fill="#00bce9" stroke="#123c49" strokeWidth="2.5"/>
          <path d="m25 6 4-4 9 9-4 4z" fill="#f5e3bb" stroke="#123c49" strokeWidth="2"/>
          <path d="m5 31 5-5 5 5-5 5z" fill="#087d65" stroke="#123c49" strokeWidth="2"/>
        </svg></div><div><b>TERRARIA</b><small>PROGRESS TRACKER</small></div></div>
        <button type="button" className="mobile-nav-toggle" aria-label={mobileNavOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)}>
          {mobileNavOpen ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>
      <div className="world-switch"><span className="eyebrow">ТЕКУЩИЙ МИР</span><b>{session?.world.name || 'For The Worthy'}</b><small>{session ? `${session.world.difficulty} · ${session.world.evilBiome} · ${session.world.gameVersion}` : 'Master · Crimson · 1.4.5.x'}</small>{session && <button className="invite-code" onClick={() => navigator.clipboard.writeText(session.world.joinCode)}>КОД МИРА · {session.world.joinCode}</button>}</div>
      <div className="nav-label">МИР</div>
      {nav.map(n => <button key={n.id} className={'nav-item ' + (n.tabs.includes(tab) ? 'active' : '')} onClick={() => { setTab(n.id); setMobileNavOpen(false) }}>
        <n.icon size={17}/>{n.label}
      </button>)}
      {canSeeAdmin && <button className={'nav-item ' + (tab === 'admin' ? 'active' : '')} onClick={() => { setTab('admin'); setMobileNavOpen(false) }}><Settings size={17}/>Администрирование</button>}
      <div className="sidebar-bottom">
        {canSeeAdmin && <div className="connection"><span className="status-dot"/> {isRemoteMode ? 'REMOTE API' : 'DEMO MODE'} <small>{isRemoteMode ? 'Supabase · синхронизация' : 'Локальное сохранение'}</small></div>}
        <button className={'nav-item ' + (tab === 'settings' ? 'active' : '')} onClick={() => { setTab('settings'); setMobileNavOpen(false) }}><Settings size={17}/>Настройки</button>
      </div>
    </aside>
    {nextBoss && <div className="boss-ambient" aria-hidden="true">
      <div className={'boss-ambient-sprite ' + (nextBoss.id === 'mechs' ? 'boss-ambient-mechs' : '')}>
        {(bossWikiSprites[nextBoss.id] || []).map(file => <img key={file} src={`https://images.weserv.nl/?url=${encodeURIComponent(`terraria.wiki.gg/wiki/Special:FilePath/${file}`)}`} alt="" loading="lazy" />)}
      </div>
      <div className="boss-ambient-label"><span>СЛЕДУЮЩИЙ БОСС</span><b>{nextBoss.name}</b></div>
    </div>}
    <main className="main">
      <header className="topbar">
        <div className="crumb">МИРЫ <ChevronRight size={13}/> <b>{(session?.world.name || 'FOR THE WORTHY').toUpperCase()}</b> <ChevronRight size={13}/> {pageTitle.toUpperCase()}</div>
        <div className="top-actions"><span className="version">{session?.world.gameVersion || 'VANILLA 1.4.5.x'}</span><PixelAvatar playerId={player.id} className="avatar"/><span className="player-name">{player.name}</span>{session && <button className="logout-button" onClick={handleLogout}>Выйти</button>}</div>
      </header>
      <div className="content">
        {syncError && <div className="notice sync-error">Синхронизация: {syncError}</div>}
        {(tab === 'settings' || tab === 'admin') && <div className="page-heading">
          <div><div className="eyebrow">TERRARIA TRACKER</div><h1>{pageTitle}</h1></div>
        </div>}
        {activeGroup && subnav[activeGroup.id] && <div className="section-tabs" role="tablist" aria-label="Подразделы">
          {subnav[activeGroup.id]!.map(entry => <button type="button" role="tab" aria-selected={tab === entry.id} className={tab === entry.id ? 'selected' : ''} key={entry.id} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
        </div>}
        {tab === 'players' && <>
          <section className="player-roster">
            <div className="player-roster-heading">
              <div><span className="eyebrow">WORLD ROSTER</span><h2>Персонажи мира</h2></div>
              <span>{currentPlayers.length} {currentPlayers.length === 1 ? 'игрок' : 'игрока'}</span>
            </div>
            <div className="player-roster-grid">{currentPlayers.map(p => {
              const gear = getClassProgressItems(
                catalogItems,
                p.gameClass,
                itemId => statusForPlayer(p.id, itemId),
                hideWeakerGear,
              )
              const collected = gear.filter(item => statusForPlayer(p.id, item.id) === 'owned').length
              const percent = Math.round(collected / Math.max(gear.length, 1) * 100)
              return <button type="button" className={'player-roster-card ' + (selected === p.id ? 'selected' : '')} onClick={() => setSelected(p.id)} key={p.id}>
                <PixelAvatar playerId={p.id} className="roster-emblem"/>
                <span className="roster-identity"><b>{p.name}</b><small>{classLabel(p.gameClass)}</small></span>
                <span className="roster-progress"><b>{percent}%</b><small>{collected}/{gear.length}</small></span>
                <span className="roster-progress-track"><i style={{ width: percent + '%' }}/></span>
              </button>
            })}</div>
          </section>

          <CharacterLoadout
            player={player}
            items={catalogItems}
            statusForItem={itemId => statusForPlayer(player.id, itemId)}
            disabled={isRemoteMode && selected !== session?.player.id}
            onOpenCatalog={() => setTab('catalog')}
          />
        </>}
        {tab === 'accessories' && <AccessoryBuilds items={catalogItems} onOpenCraft={setCraftModalItem}/>}
        {tab === 'notes' && <section className="notes-layout">
          <Panel as="form" className="notes-editor" onSubmit={saveTeamNote}>
            <div className="panel-head"><h2>{editingNote ? 'Редактировать заметку' : 'Новая заметка'}</h2><ClipboardList size={18}/></div>
            <label>Заголовок<input required maxLength={120} value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Задача команды"/></label>
            <label>Описание / чек-лист<textarea rows={6} maxLength={10000} value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="План, ресурсы, детали..."/></label>
            <div className="notes-form-row">
              <label>Статус<select value={noteStatus} onChange={e => setNoteStatus(e.target.value as TeamNote['status'])}><option value="backlog">Бэклог</option><option value="doing">В работе</option><option value="done">Готово</option></select></label>
              <label>Приоритет<select value={notePriority} onChange={e => setNotePriority(e.target.value as TeamNote['priority'])}><option value="low">Низкий</option><option value="normal">Обычный</option><option value="high">Высокий</option></select></label>
            </div>
            <fieldset className="notes-players"><legend>Привязать игроков</legend>{currentPlayers.map(member => <label key={member.id}><input type="checkbox" checked={notePlayers.includes(member.id)} onChange={e => setNotePlayers(old => e.target.checked ? [...old, member.id] : old.filter(id => id !== member.id))}/>{member.name} · {classLabel(member.gameClass)}</label>)}</fieldset>
            <div className="notes-actions">
              <Button variant="primary" size="sm" type="submit" leadingIcon={<Plus size={14}/>}>{editingNote ? 'Сохранить' : 'Добавить заметку'}</Button>
              {editingNote && <Button variant="ghost" size="sm" onClick={resetNoteForm}>Отмена</Button>}
            </div>
          </Panel>
          <Panel as="section" className="notes-board">
            <div className="panel-head"><div><h2>Бэклог команды</h2><small>{teamNotes.length} заметок</small></div><ClipboardList size={18}/></div>
            <div className="notes-filters">{[['all', 'Все'], ['backlog', 'Бэклог'], ['doing', 'В работе'], ['done', 'Готово']].map(([v, l]) => <Button key={v} size="sm" variant={noteFilter === v ? 'primary' : 'ghost'} className={noteFilter === v ? 'selected' : ''} onClick={() => setNoteFilter(v as typeof noteFilter)}>{l}</Button>)}</div>
            <div className="notes-list">
              {teamNotes.filter(note => noteFilter === 'all' || note.status === noteFilter).map(note => <Panel as="article" className="team-note" key={note.id}>
                <div className="team-note-top">
                  <Badge tone={note.priority === 'high' ? 'danger' : note.priority === 'low' ? 'neutral' : 'info'}>{note.priority === 'high' ? 'Высокий приоритет' : note.priority === 'low' ? 'Низкий приоритет' : 'Обычный приоритет'}</Badge>
                  <Badge tone={note.status === 'done' ? 'success' : note.status === 'doing' ? 'warning' : 'neutral'}>{note.status === 'done' ? 'Готово' : note.status === 'doing' ? 'В работе' : 'Бэклог'}</Badge>
                </div>
                <h3>{note.title}</h3>
                {note.body && <p>{note.body}</p>}
                <div className="team-note-players">{note.playerIds.map(id => currentPlayers.find(member => member.id === id)).filter(Boolean).map(member => <span key={member!.id}>{member!.name}</span>)}</div>
                <small>{new Date(note.updatedAt).toLocaleString('ru-RU')}</small>
                <div className="team-note-actions">
                  <Button size="sm" variant="secondary" onClick={() => editNote(note)}>Изменить</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteTeamNote(note.id)} leadingIcon={<Trash2 size={13}/>}>Удалить</Button>
                </div>
              </Panel>)}
              {teamNotes.length === 0 && <p>Заметок пока нет. Добавь первую задачу.</p>}
            </div>
          </Panel>
        </section>}

        {tab === 'alchemy' && <section className="alchemy-page">
          <div className="alchemy-intro"><div><span className="eyebrow">CRAFTING COMPENDIUM</span><h2>Алхимия и полезные рецепты</h2><p>Подборка базовых боевых зелий для подготовки к боссам. Рецепты для версии Desktop 1.4.5.x.</p></div><div className="alchemy-station"><FlaskConical size={28}/><b>Алхимический стол</b><small>33% шанс не потратить каждый ингредиент</small></div></div>
          <div className="alchemy-filters"><input value={potionQuery} onChange={e=>setPotionQuery(e.target.value)} placeholder="Найти зелье или ингредиент..."/><select value={potionFilter} onChange={e=>setPotionFilter(e.target.value)}><option>Все</option><option>Бой</option><option>Защита</option><option>Исследование</option><option>Магия</option></select></div>
          <div className="potion-grid">{potionRecipes.filter(recipe=>(potionFilter==='Все'||recipe.group===potionFilter)&&([recipe.name,recipe.effect,...recipe.ingredients].join(' ').toLowerCase().includes(potionQuery.toLowerCase()))).map(recipe=><Panel as="article" unstyled className="potion-card" key={recipe.name}><div className="potion-card-top"><span>{recipe.group}</span><small>{recipe.station}</small></div><div className="potion-card-title"><PotionItemIcon icon={potionImageFiles[recipe.name]} className="potion-art" label={recipe.name}/><div><h3>{recipe.name}</h3><p>{recipe.effect}</p></div></div><div className="potion-ingredients"><b>Ингредиенты</b>{recipe.ingredients.map(ingredient=><span className="potion-ingredient" key={ingredient}><PotionItemIcon icon={potionIngredientImages[ingredient]} className="potion-ingredient-art" label={ingredient}/><span>{ingredient}</span></span>)}</div><small className="potion-amount">Выход: {recipe.amount}</small></Panel>)}</div>
          <div className="alchemy-tips"><h3>Полезно знать</h3><ul><li>Алхимический стол находится в Данже и после победы над Скелетроном может быть получен также рыбалкой в Данже.</li><li>Алхимический стол даёт отдельный шанс 1/3 не потратить каждую единицу каждого ингредиента.</li><li>Колба алхимика заменяет алхимический стол и увеличивает длительность большинства эффектов зелий на 20%.</li><li>Колбы для оружия создаются не на алхимическом столе, а на станции для настоев (Imbuing Station).</li></ul><a href="https://terraria.wiki.gg/wiki/Alchemy" target="_blank" rel="noreferrer">Официальная Terraria Wiki: зелья и алхимия</a></div>
        </section>}
        {tab === 'progression' && <CharacterLoadout
          player={player}
          items={catalogItems}
          statusForItem={itemId => statusForPlayer(player.id, itemId)}
          disabled={isRemoteMode && selected !== session?.player.id}
          onOpenCatalog={() => setTab('catalog')}
        />}
        {tab === 'companion' && <ProgressionCompanion
          playerName={player.name}
          gameClass={player.gameClass}
          catalog={catalogItems}
          bosses={bosses}
          statusForItem={itemId => statusForPlayer(player.id, itemId)}
          onItemStatus={setStatus}
          bossStatus={bossId => bossStatus(bossId) as 'defeated' | 'pending'}
          onBossStatus={setBossStatus}
          disabled={isRemoteMode && selected !== session?.player.id}
        />}
        {tab === 'inventory' && <>
          {isRemoteMode && session && <Panel className="panel inventory-controls">
            <div className="panel-head"><h2>Управление количеством</h2><Backpack size={17}/></div>
            <div className="inventory-form">
              <label>Предмет<select value={inventoryItemId} onChange={e=>setInventoryItemId(e.target.value)}>{catalogItems.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>Количество<input type="number" min="0" max="99999" value={inventoryQty} onChange={e=>setInventoryQty(e.target.value)}/></label>
              <Button size="sm" variant="primary" onClick={saveInventoryQuantity}>Сохранить у себя</Button>
            </div>
            <div className="inventory-form transfer-form">
              <label>Получатель<select value={transferTarget} onChange={e=>setTransferTarget(e.target.value)}><option value="">Выбрать игрока</option>{currentPlayers.filter(p=>p.id!==session.player.id).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
              <label>Количество<input type="number" min="1" max="99999" value={transferQty} onChange={e=>setTransferQty(e.target.value)}/></label>
              <Button size="sm" variant="secondary" onClick={transferInventory}>Передать</Button>
            </div>
          </Panel>}
          <div className="notice"><Backpack size={18}/> {isRemoteMode ? "Инвентарь синхронизируется через Supabase. Передача работает только в пределах текущего мира." : "В демо-режиме инвентарь показывает предметы, отмеченные как полученные."}</div>
          <div className="stats-row"><Stat label="Предметов в команде" value={String(teamCount)}/><Stat label="Игроков" value={String(currentPlayers.length)}/><Stat label="Активных целей" value={String(catalogItems.filter(i => i.category !== 'material' && (statuses[i.id] === 'planned' || statuses[i.id] === 'crafting')).length)}/></div>
          {isRemoteMode && <div className="item-grid">{remoteInventory.map(row => {
            const item = catalogItems.find(x => x.id === row.itemId)
            const owner = currentPlayers.find(x => x.id === row.playerId)
            return <Panel as="article" className="item-card" key={row.id}><ItemArtwork item={item || { icon: '📦' }} className="item-art"/><div className="item-details"><b>{item ? <button type="button" className="item-recipe-link" onClick={() => setCraftModalItem(item)}>{item.name}<GitBranch size={13}/></button> : row.itemId}</b><small>{owner?.name || 'Участник'} · резерв: {row.reservedQuantity}</small><Badge tone="success">Количество: {row.quantity}</Badge></div></Panel>
          })}</div>}
          {!isRemoteMode && <div className="item-grid">{catalogItems.filter(i => i.category !== 'material' && statuses[i.id] === 'owned').map(i => <Panel as="article" className="item-card" key={i.id}><ItemArtwork item={i} className="item-art"/><div className="item-details"><b><button type="button" className="item-recipe-link" onClick={() => setCraftModalItem(i)}>{i.name}<GitBranch size={13}/></button></b><small>{i.gameClass.join(', ')}</small><Badge tone="success">Есть в команде</Badge></div></Panel>)}</div>}
        </>}
        {tab === 'bosses' && <>
          <div className="notice"><Skull size={18}/> Boss Gates: отметка босса открывает последующие этапы. В демо используются примерные связи — перед production их нужно сверить с игровыми условиями 1.4.5.x.</div>
          <div className="boss-grid">{bosses.map(b => <Panel as="article" className="boss-card" key={b.id}><div className={'boss-portrait ' + (bossStatus(b.id) === 'defeated' ? 'won' : '')}>{bossStatus(b.id) === 'defeated' ? '☠' : '?'}</div><div><b>{b.name}</b><small>{b.stage}</small><Badge tone={bossStatus(b.id) === 'defeated' ? 'success' : 'warning'}>{bossStatus(b.id) === 'defeated' ? 'Побеждён' : b.requires.length ? 'Зависит от предыдущего этапа' : 'Доступен'}</Badge></div><Button size="sm" variant={bossStatus(b.id) === 'defeated' ? 'secondary' : 'primary'} onClick={() => setBossStatus(b.id,bossStatus(b.id) === 'defeated' ? 'pending' : 'defeated')}>{bossStatus(b.id) === 'defeated' ? 'Отменить' : 'Отметить'}</Button></Panel>)}</div>
        </>}
        {tab === 'crafting' && <>
          <div className="craft-layout">
            <Panel className="panel craft-picker"><div className="panel-head"><h2>Целевой предмет</h2><Hammer size={17}/></div>
              <label className="craft-search"><Search size={16}/><input type="search" value={craftQuery} onChange={event => setCraftQuery(event.target.value)} placeholder="Поиск предмета..." aria-label="Поиск предмета для дерева крафта"/>{craftQuery && <button type="button" onClick={() => setCraftQuery('')} aria-label="Очистить поиск"><X size={14}/></button>}</label>
              <div className="craft-search-count">{catalogItems.filter(i => i.category !== 'material' && i.recipe?.length && (!craftQuery.trim() || [i.name,i.ru,i.id].some(value => value.toLowerCase().includes(craftQuery.trim().toLowerCase())))).length} предметов</div>
              {catalogItems.filter(i => i.category !== 'material' && i.recipe?.length && (!craftQuery.trim() || [i.name,i.ru,i.id].some(value => value.toLowerCase().includes(craftQuery.trim().toLowerCase())))).map(i => <button className={'craft-choice ' + (target === i.id ? 'selected' : '')} onClick={() => setTarget(i.id)} key={i.id}><ItemArtwork item={i} className="craft-choice-art"/><b>{i.name}</b><ChevronRight size={15}/></button>)}
              {catalogItems.filter(i => i.category !== 'material' && i.recipe?.length && (!craftQuery.trim() || [i.name,i.ru,i.id].some(value => value.toLowerCase().includes(craftQuery.trim().toLowerCase())))).length === 0 && <p className="craft-search-empty">Ничего не найдено</p>}
            </Panel>
            <Panel className="panel tree-panel"><div className="panel-head"><div><h2>{current?.name || 'Выбери предмет'}</h2><small className="muted">Дерево компонентов · {tree?.station || current?.station || 'Способ получения'}</small></div><GitBranch size={18}/></div>
              {(current?.recipes?.length || 0) > 1 && <label className="recipe-select">Вариант рецепта<select value={recipeIndex} onChange={event => setRecipeIndex(Number(event.target.value))}>{current.recipes?.map((recipe, index) => <option value={index} key={recipe.id}>{recipe.station || 'Без станции'} · {recipe.version || 'Все версии'} · ×{recipe.amount}</option>)}</select></label>}
              <div className="tree-root">{tree && <TreeNode node={tree} statuses={statuses} onOpenItem={setCraftModalItem}/>}</div>
              <div className="notice compact"><Sparkles size={16}/> Рецепты загружаются из Terraria Wiki. Проверьте версию игры и доступность конкретного рецепта для вашей платформы.</div>
            </Panel>
          </div>
        </>}
        {tab === 'admin' && canSeeAdmin && <>
          <Panel as="section" className="admin-panel">
            <SectionHeading
              className="admin-panel-heading"
              title="Администрирование мира"
              description="Управление участниками и правами доступа."
              action={<Badge tone={session?.player.role === 'owner' ? 'success' : 'info'}>{session?.player.role === 'owner' ? 'Создатель' : 'Администратор'}</Badge>}
            />
            <div className="admin-summary"><b>{remotePlayers.length}</b><span>участников мира</span><small>{canManageAdmins ? 'Назначать администраторов может только создатель мира.' : 'Вы можете просматривать участников. Изменение ролей доступно создателю мира.'}</small></div>
            <div className="admin-player-list">
              {remotePlayers.map(member => <Panel as="article" className="admin-player-row" key={member.id}>
                <div className="admin-player-identity"><PixelAvatar playerId={member.id} className="admin-player-avatar"/><div><b>{member.name}</b><small>{({Melee:'Ближний бой',Ranger:'Стрелок',Mage:'Маг',Summoner:'Призыватель'})[member.gameClass]}</small></div></div>
                <Badge tone={member.role === 'owner' ? 'success' : member.role === 'admin' ? 'info' : 'neutral'}>{member.role === 'owner' ? 'Создатель' : member.role === 'admin' ? 'Администратор' : 'Участник'}</Badge>
                {canManageAdmins && member.role !== 'owner' && <Button size="sm" variant="secondary" onClick={() => changePlayerAdmin(member.id, member.role !== 'admin')}>{member.role === 'admin' ? 'Снять права' : 'Назначить админом'}</Button>}
                {canSeeAdmin && member.role !== 'owner' && member.id !== session?.player.id && (canManageAdmins || member.role === 'member') && <Button size="sm" variant="danger" onClick={() => removeWorldPlayer(member)}>Исключить</Button>}
              </Panel>)}
            </div>
          </Panel>
        </>}
        {tab === 'settings' && <>
          <div className="settings-layout">
            <div className="settings-column">
            <Panel as="section" unstyled className="settings-section">
              <div className="settings-section-heading"><SlidersHorizontal size={19}/><div><h2>Игровой процесс</h2><p>Управление расчётом прогресса и отображением экипировки.</p></div></div>
              <label className="settings-row"><span><b>Скрывать более слабую экипировку</b><small>Не учитывать старое оружие и броню, если уже есть более сильная замена.</small></span><input type="checkbox" checked={hideWeakerGear} onChange={event => setHideWeakerGear(event.target.checked)}/></label>
            </Panel>
            <Panel as="section" unstyled className="settings-section">
              <div className="settings-section-heading"><BookOpen size={19}/><div><h2>Данные и сохранения</h2><p>Создание резервной копии и перенос прохождения.</p></div></div>
              <div className="settings-actions"><button type="button" className="small-button" onClick={exportProgress}><BookOpen size={15}/> Экспорт JSON</button><label className="small-button settings-file-button"><Search size={15}/> Импорт JSON<input type="file" accept="application/json,.json" onChange={importProgress} disabled={isRemoteMode}/></label></div>
              <div className="settings-warning"><b>Сброс прогресса</b><span>{isRemoteMode ? 'В сетевом режиме сброс недоступен — данные мира общие.' : 'Удаляет локальные отметки предметов и боссов.'}</span><Button size="sm" variant="danger" className="settings-danger" disabled={isRemoteMode} onClick={resetProgress} leadingIcon={<RotateCcw size={14}/>}>Сбросить прогресс</Button></div>
            </Panel>
            </div>
            <div className="settings-column">
            <Panel as="section" unstyled className="settings-section">
              <div className="settings-section-heading"><Settings size={19}/><div><h2>Интерфейс</h2><p>Настрой внешний вид под размер экрана.</p></div></div>
              <label className="settings-row"><span><b>Компактный режим</b><small>Уменьшает отступы и плотнее размещает карточки.</small></span><input type="checkbox" checked={compactMode} onChange={event => setCompactMode(event.target.checked)}/></label>
              <label className="settings-row"><span><b>Анимации</b><small>Отключает анимации и переходы интерфейса.</small></span><input type="checkbox" checked={animationsEnabled} onChange={event => setAnimationsEnabled(event.target.checked)}/></label>
              <label className="settings-scale"><span><b>Масштаб интерфейса</b><strong>{uiScale}%</strong></span><input type="range" min="90" max="110" step="5" value={uiScale} onChange={event => setUiScale(Number(event.target.value))}/><small>Изменяет базовый размер текста. Для мобильных устройств масштаб лучше оставить 100%.</small></label>
            </Panel>
            </div>
            <div className="settings-footnote">Настройки интерфейса и фильтр экипировки сохраняются в этом браузере. Экспорт включает отметки предметов, боссов и основные предпочтения.</div>
          </div>
        </>}
        {tab === 'catalog' && <>
          <Panel as="section" unstyled className="catalog-toolbar">
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
          </Panel>
          {filtered.length
            ? <div className="catalog-grid">{filtered.map(item => <CatalogItemCard key={item.id} item={item} status={statuses[item.id] || 'missing'} onStatus={setStatus} onCraft={setCraftModalItem} disabled={isRemoteMode && selected !== session?.player.id}/>)}</div>
            : <div className="catalog-empty"><Search size={25}/><b>Ничего не найдено</b><span>Измени запрос или сбрось фильтры.</span><button onClick={resetCatalogFilters}>Сбросить фильтры</button></div>}
        </>}
        <footer>TERRARIA PROGRESS TRACKER {canSeeAdmin && <span>НЕОФИЦИАЛЬНЫЙ ФАН-ПРОЕКТ · {isRemoteMode ? "REMOTE DATA" : "DEMO DATA"}</span>}</footer>
      </div>
    </main>
    {craftModalItem && <RecipeModal
      key={craftModalItem.id}
      item={craftModalItem}
      catalogItems={catalogItems}
      statuses={statuses}
      onClose={() => setCraftModalItem(null)}
      onOpenItem={setCraftModalItem}
    />}
    </div>
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
  return <div className="auth-shell"><Panel as="form" unstyled className="auth-card" onSubmit={submit}>
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
  </Panel></div>
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

function classLabel(gameClass: GameClass) {
  const labels: Record<GameClass, string> = {
    Melee: 'Ближний бой', Ranger: 'Стрелок', Mage: 'Маг', Summoner: 'Призыватель',
  }
  return labels[gameClass]
}

function PlayerArmorSetCard({ set, items, allItems, matchedCount, statusForItem, onStatus, onCraft, disabled = false }: {
  set: ReturnType<typeof armorSetsForClass>[number]
  items: Item[]
  allItems: Item[]
  matchedCount: number
  statusForItem: (itemId: string) => ItemStatus
  onStatus: (id: string, status: ItemStatus) => void
  onCraft: (item: Item) => void
  disabled?: boolean
}) {
  const labels: Record<ItemStatus, string> = {
    owned: 'Получен', planned: 'В планах', crafting: 'В работе',
    missing: 'Не получен', skipped: 'Пропущен',
  }
  const classNames: Record<GameClass, string> = {
    Melee: 'Ближний бой', Ranger: 'Стрелок', Mage: 'Маг', Summoner: 'Призыватель',
  }
  const visiblePieces = set.pieces.filter(piece => items.some(item => item.name === piece.name))
  const collectedCount = set.pieces.filter(piece => {
    const item = allItems.find(entry => entry.name === piece.name)
    return item && statusForItem(item.id) === 'owned'
  }).length
  const hiddenCount = set.pieces.length - visiblePieces.length

  return <Panel as="article" className="player-armor-set-card">
    <header className="player-armor-set-head">
      <div>
        <span className="eyebrow">КОМПЛЕКТ БРОНИ · {stageLabel(set.stage)}</span>
        <h3>{set.name}</h3>
        <div className="player-armor-set-classes">{set.classes.map(gameClass => <span key={gameClass}>{classNames[gameClass]}</span>)}</div>
      </div>
      <Badge tone={collectedCount === set.pieces.length ? 'success' : 'info'}>{collectedCount}/{set.pieces.length} получено</Badge>
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
    <div className="player-armor-pieces">
      {visiblePieces.map(piece => {
        const item = items.find(entry => entry.name === piece.name)
        if (!item) return null
        const status = statusForItem(item.id)
        const effect = cleanWikiText(armorPieceEffect(set, piece.name) || piece.effect || item.equipmentEffect || item.description)
        return <div className="player-armor-piece" key={piece.name}>
          <ItemArtwork item={item} className="player-armor-piece-art"/>
          <div className="player-armor-piece-info">
            <span className="player-armor-piece-slot">{piece.slot}</span>
            <button type="button" className="item-recipe-link armor-recipe-link" onClick={() => onCraft(item)} title="Открыть дерево крафта">{item.name}<GitBranch size={12}/></button>
            {effect && <small>{effect}</small>}
            <Badge tone={status === 'owned' ? 'success' : status === 'crafting' ? 'info' : status === 'planned' ? 'warning' : status === 'skipped' ? 'neutral' : 'danger'}>{labels[status]}</Badge>
          </div>
          <select value={status} disabled={disabled} onChange={event => onStatus(item.id, event.target.value as ItemStatus)} aria-label={'Статус ' + item.name}>
            <option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option>
          </select>
        </div>
      })}
    </div>
    {hiddenCount > 0 && <small className="player-armor-filter-note">Скрыто более слабых частей: {hiddenCount}. Они не учитываются в прогрессе.</small>}
    {matchedCount < items.length && <small className="player-armor-filter-note">Поиск или фильтры совпали с {matchedCount} из {items.length} отображаемых частей.</small>}
  </Panel>
}

function WeakerGearToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="weaker-gear-toggle">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>
    <span><b>Скрыть более слабую экипировку</b><small>Старое оружие и части брони, для которых уже есть более сильная замена, не показываются и не входят в расчёт прогресса.</small></span>
  </label>
}

function PlayerGearCard({ item, status, onStatus, onCraft, disabled = false }: {
  item: Item
  status: ItemStatus
  onStatus: (id: string, status: ItemStatus) => void
  onCraft: (item: Item) => void
  disabled?: boolean
}) {
  const labels: Record<ItemStatus, string> = {
    owned: 'Получен', planned: 'В планах', crafting: 'В работе',
    missing: 'Не получен', skipped: 'Пропущен',
  }
  const description = cleanWikiText(item.equipmentEffect || item.description)
  return <Panel as="article" className="player-gear-card">
    <ItemArtwork item={item} className="player-gear-art"/>
    <div className="player-gear-main">
      <div className="player-gear-tags"><span>{categoryLabel(item.category)}</span><span>{stageLabel(item.stage)}</span></div>
      <h3><button type="button" className="item-recipe-link" onClick={() => onCraft(item)} title="Открыть дерево крафта">{item.name}<GitBranch size={12}/></button></h3>
      {item.ru && item.ru !== item.name && <p className="player-gear-ru">{item.ru}</p>}
      {description && <p className="player-gear-description">{description}</p>}
      <div className="player-gear-highlights">
        {item.damage !== null && item.damage !== undefined && <span>{item.damage} урона</span>}
        {item.defense !== null && item.defense !== undefined && item.defense > 0 && <span>{item.defense} защиты</span>}
        {item.damageType && <span>{item.damageType}</span>}
        {item.buffName && <span className="player-gear-buff"><Sparkles size={11}/> Эффект: {item.buffName}{item.buffDuration ? ` · ${item.buffDuration}` : ''}</span>}
      </div>
      <small className="player-gear-source">{item.source}</small>
      <div className="player-gear-status">
        <Badge tone={status === 'owned' ? 'success' : status === 'crafting' ? 'info' : status === 'planned' ? 'warning' : status === 'skipped' ? 'neutral' : 'danger'}>{labels[status]}</Badge>
        <select value={status} disabled={disabled} onChange={event => onStatus(item.id, event.target.value as ItemStatus)} aria-label={'Статус ' + item.name}>
          <option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option>
        </select>
      </div>
    </div>
  </Panel>
}

function cleanWikiText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/?[a-z][^<>]*>/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
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
  if (/^\d+$/.test(stage)) return `Этап ${stage}`
  if (stage === 'Pre-Hardmode') return 'Pre-Hardmode'
  if (stage === 'Hardmode') return 'Hardmode'
  if (stage === 'Post-Mechanical') return 'После механических боссов'
  if (stage === 'Post-Plantera') return 'После Плантеры'
  if (stage === 'Post-Golem') return 'После Голема'
  if (stage === 'Post-Moon Lord') return 'После Лунного лорда'
  return 'Этап не указан'
}

function CatalogItemCard({ item, status, onStatus, onCraft, disabled = false }: {
  item: Item
  status: ItemStatus
  onStatus: (id: string, status: ItemStatus) => void
  onCraft: (item: Item) => void
  disabled?: boolean
}) {
  const labels: Record<ItemStatus, string> = {
    owned: 'Получен', planned: 'В планах', crafting: 'В работе',
    missing: 'Не получен', skipped: 'Пропущен',
  }
  const description = cleanWikiText(item.description)
  return <Panel as="article" className="catalog-card">
    <div className="catalog-card-top">
      <ItemArtwork item={item} className="catalog-card-art"/>
      <div className="catalog-card-tags"><span>{categoryLabel(item.category)}</span><span>{stageLabel(item.stage)}</span></div>
    </div>
    <div className="catalog-card-body">
      <h3><button type="button" className="item-recipe-link" onClick={() => onCraft(item)} title="Открыть дерево крафта">{item.name}<GitBranch size={13}/></button></h3>
      {item.ru && item.ru !== item.name && <p className="catalog-card-ru">{item.ru}</p>}
      {description && <p className="catalog-card-description">{description}</p>}
      <div className="catalog-card-classes">{item.gameClass.map(gameClass => <span key={gameClass}>{({Melee:'Melee',Ranger:'Ranger',Mage:'Mage',Summoner:'Summoner'})[gameClass]}</span>)}</div>
    </div>
    <div className="catalog-card-footer">
      <Badge tone={status === 'owned' ? 'success' : status === 'crafting' ? 'info' : status === 'planned' ? 'warning' : status === 'skipped' ? 'neutral' : 'danger'}>{labels[status]}</Badge>
      <select value={status} disabled={disabled} onChange={event => onStatus(item.id, event.target.value as ItemStatus)} aria-label={'Статус ' + item.name}>
        <option value="owned">Есть</option><option value="planned">В планах</option><option value="crafting">В работе</option><option value="missing">Нет</option><option value="skipped">Не нужен</option>
      </select>
    </div>
  </Panel>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <StatCard label={label} value={value} />
}
function buildRecipeTree(id: string, catalogItems: Item[], rootRecipeIndex = 0, depth = 0, seen: string[] = []): any {
  const item = catalogItems.find(entry => entry.id === id)
  if (!item || depth > 20) return null
  const cycle = seen.includes(id)
  const recipes = item.recipes || []
  const selectedRecipe = recipes[depth === 0 ? rootRecipeIndex : 0] || recipes[0]
  const ingredients = selectedRecipe?.ingredients || item.recipe || []
  const children = cycle ? [] : ingredients.map(ingredient => {
    const child = buildRecipeTree(ingredient.itemId, catalogItems, 0, depth + 1, [...seen, id])
    if (child) return { qty: ingredient.qty, alternatives: ingredient.alternatives || [], ...child }
    return {
      it: { id: ingredient.itemId, name: ingredient.name || ingredient.itemId, icon: '◇', imageUrl: null } as Item,
      missingCatalog: true, depth: depth + 1, cycle: false, station: null, children: [],
      qty: ingredient.qty, alternatives: ingredient.alternatives || [],
    }
  })
  return { it: item, depth, cycle, station: selectedRecipe?.station || item.station, children }
}

function RecipeModal({ item, catalogItems, statuses, onClose, onOpenItem }: {
  item: Item
  catalogItems: Item[]
  statuses: Record<string, ItemStatus>
  onClose: () => void
  onOpenItem: (item: Item) => void
}) {
  const [recipeIndex, setRecipeIndex] = useState(0)
  const tree = useMemo(() => buildRecipeTree(item.id, catalogItems, recipeIndex), [item.id, catalogItems, recipeIndex])
  const hasRecipe = Boolean(item.recipe?.length || item.recipes?.some(recipe => recipe.ingredients.length))
  const variants = item.recipes || []
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  return <div className="recipe-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <Panel as="section" className="recipe-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title">
      <header className="recipe-modal-header">
        <div className="recipe-modal-item">
          <ItemArtwork item={item} className="recipe-modal-art"/>
          <div><span className="eyebrow">ДЕРЕВО КРАФТА · {categoryLabel(item.category)}</span><h2 id="recipe-modal-title">{item.name}</h2><small>{stageLabel(item.stage)}{tree?.station ? ` · ${tree.station}` : ''}</small></div>
        </div>
        <Button variant="ghost" className="recipe-modal-close" onClick={onClose} aria-label="Закрыть"><X size={20}/></Button>
      </header>
      {variants.length > 1 && <label className="recipe-modal-variant"><span>Вариант рецепта</span><select value={recipeIndex} onChange={event => setRecipeIndex(Number(event.target.value))}>
        {variants.map((recipe, index) => <option value={index} key={recipe.id}>{recipe.station || 'Без станции'} · {recipe.version || 'Все версии'} · ×{recipe.amount}</option>)}
      </select></label>}
      <div className="recipe-modal-body">
        {tree && <div className="tree-root"><TreeNode node={tree} statuses={statuses} onOpenItem={onOpenItem}/></div>}
        {!hasRecipe && <div className="recipe-modal-empty"><b>Рецепт не найден в каталоге</b><p>{item.source || 'Для этого предмета пока не указаны компоненты крафта.'}</p></div>}
        {hasRecipe && tree?.children.length === 0 && <div className="recipe-modal-empty"><b>Компоненты рецепта не удалось связать с каталогом</b><p>{item.source || 'Попробуй проверить предметы в каталоге.'}</p></div>}
      </div>
      <footer className="recipe-modal-footer"><span>{item.source || 'Источник получения не указан'}</span>{item.station && <small>Станция: {item.station}</small>}</footer>
    </Panel>
  </div>
}

function TreeNode({ node, statuses, onOpenItem }: {
  node: any
  statuses: Record<string, ItemStatus>
  onOpenItem?: (item: Item) => void
}) {
  const [open, setOpen] = useState(true)
  const status = node.it ? statuses[node.it.id] : undefined
  return <div className="tree-node">
    <div className={'tree-item ' + (status === 'owned' ? 'has-item' : '')}>
      <Button
        size="sm"
        variant="ghost"
        className="tree-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Свернуть компоненты' : 'Развернуть компоненты'}
        aria-expanded={open}
        disabled={!node.children.length}
      >{node.children.length ? (open ? '−' : '+') : '·'}</Button>
      {node.it && <ItemArtwork item={node.it} className="tree-item-art"/>}
      {node.it && !node.missingCatalog
        ? <button type="button" className="tree-recipe-link" onClick={() => onOpenItem?.(node.it)} title="Открыть дерево крафта">{node.it.name}<GitBranch size={12}/></button>
        : <b>{node.it?.name || 'Неизвестный компонент'}</b>}
      <Badge tone={status === 'owned' ? 'success' : 'warning'}>{status === 'owned' ? 'Есть' : 'Проверить'}{node.qty ? ` · ×${node.qty}` : ''}</Badge>
      {node.alternatives?.length > 0 && <small>Альтернативы: {node.alternatives.map((option: { name: string }) => option.name).join(' / ')}</small>}
    </div>
    {open && node.children.length > 0 && <div className="tree-children">{node.children.map((child: any, i: number) => <div className="tree-branch" key={i}><TreeNode node={child} statuses={statuses} onOpenItem={onOpenItem}/></div>)}</div>}
  </div>
}
