import { items } from '../data'
import type { Item } from '../types'
import type {
  AuthInput, BossRecord, CreateWorldInput, InventoryRecord, JoinWorldInput,
  ProgressRecord, TeamNote, TrackerApi, TrackerPlayer, TrackerSession, TrackerWorld,
} from './api'

const STORE_KEY = 'terraria-tracker-local-v1'
const DEFAULT_WORLD: TrackerWorld = {
  id: 'demo-world', name: 'For The Worthy', joinCode: 'DEMO1234',
  gameVersion: '1.4.5.x', difficulty: 'Master', evilBiome: 'Crimson', seed: '',
}
const DEMO_PLAYERS: TrackerPlayer[] = [
  { id:'p1', name:'Михаил', gameClass:'Melee', role:'owner' },
  { id:'p2', name:'Алексей', gameClass:'Ranger', role:'member' },
  { id:'p3', name:'Дмитрий', gameClass:'Mage', role:'member' },
  { id:'p4', name:'Андрей', gameClass:'Summoner', role:'member' },
]
type LocalState = { world: TrackerWorld; players: TrackerPlayer[]; progress: ProgressRecord[]; bosses: BossRecord[]; inventory: InventoryRecord[]; notes: TeamNote[] }
function read(): LocalState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    return {
      world: parsed.world || DEFAULT_WORLD,
      players: parsed.players || DEMO_PLAYERS,
      progress: parsed.progress || [],
      bosses: parsed.bosses || [],
      inventory: parsed.inventory || [], notes: parsed.notes || [],
    }
  } catch {
    return { world: DEFAULT_WORLD, players: DEMO_PLAYERS, progress: [], bosses: [], inventory: [], notes: [] }
  }
}
function write(state: LocalState) { localStorage.setItem(STORE_KEY, JSON.stringify(state)) }
function sessionFor(world: TrackerWorld, player: TrackerPlayer): TrackerSession {
  return { token:'local-demo-token', expiresAt:new Date(Date.now()+12*3600000).toISOString(), world, player }
}

export const localApi: TrackerApi = {
  mode: 'local',
  async health() { return { status:'ok', apiVersion:'local-v1' } },
  async getCatalog(_token: string): Promise<Item[]> { return items },
  async createWorld(input: CreateWorldInput) {
    const state=read()
    const world={...DEFAULT_WORLD,id:'local-'+Date.now(),name:input.worldName,joinCode:'LOCAL123',gameVersion:input.gameVersion||'1.4.5.x',difficulty:input.difficulty||'Master',evilBiome:input.evilBiome||'Crimson',seed:input.seed||''}
    const player={id:'local-'+Date.now(),name:input.playerName,gameClass:input.gameClass,role:'owner' as const}
    state.world=world;state.players=[player];state.progress=[];state.bosses=[];state.inventory=[];write(state)
    return sessionFor(world,player)
  },
  async joinWorld(input: JoinWorldInput) { return this.login(input) },
  async login(_input: AuthInput) {
    const state=read()
    const player=state.players.find(p=>p.name.toLowerCase()===_input.playerName.toLowerCase()) || state.players[0]
    return sessionFor(state.world,player)
  },
  async logout(_token: string) {},
  async worldInfo(_token: string) { return read().world },
  async listPlayers(_token: string) { return read().players },
  async removePlayer(_token: string, playerId: string) {
    const state=read()
    const actor=state.players[0]
    const target=state.players.find(p=>p.id===playerId)
    if(actor?.role!=='owner') throw new Error('Исключать участников может только создатель мира')
    if(!target || target.role==='owner' || target.id===actor.id) throw new Error('Нельзя исключить создателя мира')
    state.players=state.players.filter(p=>p.id!==playerId)
    state.progress=state.progress.filter(x=>x.playerId!==playerId)
    state.inventory=state.inventory.filter(x=>x.playerId!==playerId)
    write(state);return {playerId}
  },
  async setPlayerAdmin(_token: string, playerId: string, isAdmin: boolean) {
    const state=read()
    const actor=state.players.find(p=>p.id===_token) || state.players[0]
    if(actor.role!=='owner') throw new Error('Назначать администраторов может только создатель мира')
    const target=state.players.find(p=>p.id===playerId)
    if(!target || target.role==='owner') throw new Error('Игрок не найден или является создателем мира')
    target.role=isAdmin?'admin':'member';write(state);return target
  },
  async getProgress(_token: string) { return read().progress },
  async setProgress(token, input) {
    const state=read()
    const player=state.players.find(p=>p.id===token) || state.players[0]
    const next:ProgressRecord={id:input.itemId,worldId:state.world.id,playerId:player.id,itemId:input.itemId,status:input.status,quantity:input.quantity,updatedAt:new Date().toISOString()}
    state.progress=state.progress.filter(x=>!(x.worldId===next.worldId&&x.playerId===next.playerId&&x.itemId===next.itemId))
    state.progress.push(next);write(state);return next
  },
  async listBosses(_token: string) { return read().bosses },
  async setBossStatus(_token, input) {
    const state=read()
    const next:BossRecord={id:input.bossId,worldId:state.world.id,bossId:input.bossId,status:input.status,defeatedAt:input.status==='defeated'?new Date().toISOString():'',updatedBy:'local'}
    state.bosses=state.bosses.filter(x=>x.bossId!==input.bossId);state.bosses.push(next);write(state);return next
  },
  async listInventory(_token: string) { return read().inventory },
  async setInventory(token, input) {
    const state=read()
    const player=state.players.find(p=>p.id===token) || state.players[0]
    const current=state.inventory.find(x=>x.playerId===player.id&&x.itemId===input.itemId)
    const next:InventoryRecord={id:current?.id||input.itemId,worldId:state.world.id,playerId:player.id,itemId:input.itemId,quantity:input.quantity,reservedQuantity:current?.reservedQuantity||0,updatedAt:new Date().toISOString()}
    state.inventory=state.inventory.filter(x=>!(x.playerId===player.id&&x.itemId===input.itemId));state.inventory.push(next);write(state);return next
  },
  async listNotes(_token: string) { return read().notes.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)) },
  async saveNote(token, input) {
    const state=read(), now=new Date().toISOString(), actor=state.players.find(p=>p.id===token)||state.players[0]
    const previous=state.notes.find(note=>note.id===input.id)
    const note:TeamNote={id:previous?.id||'note-'+Date.now(),title:input.title.trim(),body:input.body.trim(),status:input.status,priority:input.priority,playerIds:input.playerIds.filter(id=>state.players.some(p=>p.id===id)),createdBy:previous?.createdBy||actor.id,createdAt:previous?.createdAt||now,updatedAt:now}
    if(!note.title) throw new Error('У заметки должен быть заголовок')
    state.notes=state.notes.filter(x=>x.id!==note.id);state.notes.push(note);write(state);return note
  },
  async deleteNote(_token, noteId) { const state=read();state.notes=state.notes.filter(note=>note.id!==noteId);write(state) },
  async transferInventory(token, input) {
    const state=read()
    const from=state.inventory.find(x=>x.playerId===(state.players.find(p=>p.id===token)?.id || state.players[0].id)&&x.itemId===input.itemId)
    if(!from||from.quantity-from.reservedQuantity<input.quantity) throw new Error('Недостаточно предметов для передачи')
    const to=state.inventory.find(x=>x.playerId===input.toPlayerId&&x.itemId===input.itemId)
    from.quantity-=input.quantity
    if(to)to.quantity+=input.quantity
    else state.inventory.push({id:input.itemId,worldId:state.world.id,playerId:input.toPlayerId,itemId:input.itemId,quantity:input.quantity,reservedQuantity:0,updatedAt:new Date().toISOString()})
    write(state);return {duplicate:false,transferId:'local-'+Date.now()}
  },
}
