/**
 * Terraria Progress Tracker — Apps Script API v1 (MVP).
 *
 * Setup:
 * 1. Create a Google Spreadsheet.
 * 2. Set Script Property SPREADSHEET_ID to its ID.
 * 3. Run initializeSheets() once from the Apps Script editor.
 * 4. Deploy as Web app, execute as the deploying account.
 *
 * Public endpoints: health, world.create, world.join, auth.login.
 * All other actions require a short-lived bearer token.
 *
 * This is a small private-group MVP. Google Sheets is not a transactional
 * database and Apps Script has quotas. Move to PostgreSQL for larger groups.
 */
const SCHEMA = {
  Worlds: ['id','joinCode','name','gameVersion','difficulty','evilBiome','seed','status','createdAt'],
  Players: ['id','name','createdAt'],
  Memberships: ['id','worldId','playerId','gameClass','role','pinSalt','pinHash','failedAttempts','lockedUntil','createdAt'],
  Sessions: ['id','tokenHash','worldId','playerId','expiresAt','revokedAt','createdAt'],
  Items: ['id','name','nameRu','classes','category','stage','icon','source','verified'],
  PlayerItems: ['id','worldId','playerId','itemId','status','quantity','updatedAt'],
  WorldBosses: ['id','worldId','bossId','status','defeatedAt','updatedBy'],
  TeamInventory: ['id','worldId','playerId','itemId','quantity','reservedQuantity','updatedAt'],
  ItemTransfers: ['id','worldId','fromPlayerId','toPlayerId','itemId','quantity','status','createdAt'],
  InventoryTransactions: ['id','worldId','playerId','itemId','delta','reason','idempotencyKey','createdAt'],
  CraftingPlans: ['id','worldId','targetItemId','recipeId','quantity','status','createdBy','createdAt'],
  CraftingPlanMaterials: ['id','planId','itemId','requiredQuantity','availableQuantity'],
  CraftingReservations: ['id','planId','playerId','itemId','quantity','status','createdAt'],
  AuditLog: ['id','worldId','actorId','action','entityType','entityId','beforeJson','afterJson','createdAt']
};

const API_VERSION = 'v1';
const SESSION_HOURS = 12;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const CLASSES = ['Melee','Ranger','Mage','Summoner'];
const ITEM_STATUSES = ['owned','planned','crafting','missing','skipped'];

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';
  if (action === 'health') return json_({success:true,data:{status:'ok',apiVersion:API_VERSION},error:null});
  return json_({success:false,data:null,error:{code:'NOT_FOUND',message:'Unknown GET action'}});
}

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = String(body.action || '');
    const data = dispatch_(action, body);
    return json_({success:true,data:data,error:null});
  } catch (err) {
    const code = err && err.code ? err.code : 'INTERNAL_ERROR';
    const message = err && err.message ? err.message : 'Unexpected server error';
    console.error(code + ': ' + message);
    return json_({success:false,data:null,error:{code:code,message:message}});
  }
}

function dispatch_(action, body) {
  if (action === 'health') return {status:'ok',apiVersion:API_VERSION};
  ensureSchema_();
  switch (action) {
    case 'world.create': return createWorld_(body);
    case 'world.join': return joinWorld_(body);
    case 'auth.login': return login_(body);
    case 'auth.logout': return logout_(body);
    case 'world.info': return worldInfo_(body);
    case 'players.list': return listPlayers_(body);
    case 'progress.list': return listProgress_(body);
    case 'progress.set': return setProgress_(body);
    case 'bosses.list': return listBosses_(body);
    case 'boss.setStatus': return setBossStatus_(body);
    case 'inventory.list': return listInventory_(body);
    case 'inventory.set': return setInventory_(body);
    case 'inventory.transfer': return transferInventory_(body);
    default: fail_('NOT_FOUND','Unknown API action: ' + action);
  }
}

/* ---------- World and account lifecycle ---------- */

function createWorld_(body) {
  const name = text_(body.worldName, 'worldName', 2, 48);
  const playerName = text_(body.playerName, 'playerName', 2, 24);
  const pin = pin_(body.pin);
  const gameClass = gameClass_(body.gameClass || 'Melee');
  return locked_(function() {
    const now = now_();
    const world = {
      id:uuid_(), joinCode:newJoinCode_(), name:name,
      gameVersion:text_(body.gameVersion || '1.4.5.x','gameVersion',1,20),
      difficulty:text_(body.difficulty || 'Master','difficulty',1,24),
      evilBiome:text_(body.evilBiome || 'Crimson','evilBiome',1,24),
      seed:text_(body.seed || '','seed',0,80), status:'active', createdAt:now
    };
    const player = {id:uuid_(),name:playerName,createdAt:now};
    const membership = makeMembership_(world.id,player.id,gameClass,'owner',pin,now);
    append_('Worlds',world); append_('Players',player); append_('Memberships',membership);
    audit_(world.id,player.id,'world.create','World',world.id,null,{name:world.name});
    return sessionResponse_(world,player,membership);
  });
}

function joinWorld_(body) {
  const joinCode = normalizeCode_(body.joinCode);
  const playerName = text_(body.playerName,'playerName',2,24);
  const pin = pin_(body.pin);
  const gameClass = gameClass_(body.gameClass || 'Melee');
  return locked_(function() {
    const world = first_('Worlds',function(x){return x.joinCode === joinCode && x.status === 'active';});
    if (!world) fail_('WORLD_NOT_FOUND','World code is invalid or the world is inactive.');
    const duplicate = first_('Memberships',function(x){
      if (x.worldId !== world.id) return false;
      const p = first_('Players',function(y){return y.id === x.playerId;});
      return p && p.name.toLowerCase() === playerName.toLowerCase();
    });
    if (duplicate) fail_('PLAYER_EXISTS','A player with this name already belongs to the world.');
    const now = now_(), player = {id:uuid_(),name:playerName,createdAt:now};
    const membership = makeMembership_(world.id,player.id,gameClass,'member',pin,now);
    append_('Players',player); append_('Memberships',membership);
    audit_(world.id,player.id,'world.join','Player',player.id,null,{name:player.name});
    return sessionResponse_(world,player,membership);
  });
}

function login_(body) {
  const joinCode = normalizeCode_(body.joinCode);
  const playerName = text_(body.playerName,'playerName',2,24).toLowerCase();
  const pin = pin_(body.pin);
  return locked_(function() {
    const world = first_('Worlds',function(x){return x.joinCode === joinCode && x.status === 'active';});
    if (!world) fail_('AUTH_FAILED','World code, player name, or PIN is incorrect.');
    const memberships = rows_('Memberships').filter(function(m){return m.worldId === world.id;});
    let match = null, player = null;
    memberships.some(function(m) {
      const p = first_('Players',function(x){return x.id === m.playerId;});
      if (p && p.name.toLowerCase() === playerName) {match=m;player=p;return true;}
      return false;
    });
    if (!match || !player) fail_('AUTH_FAILED','World code, player name, or PIN is incorrect.');
    if (match.lockedUntil && new Date(match.lockedUntil).getTime() > Date.now()) {
      fail_('LOGIN_LOCKED','Too many failed attempts. Try again later.');
    }
    const valid = safeEqual_(match.pinHash,hashPin_(pin,match.pinSalt));
    if (!valid) {
      const attempts = Number(match.failedAttempts || 0) + 1;
      const lockUntil = attempts >= LOGIN_MAX_ATTEMPTS
        ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60000).toISOString() : '';
      patch_('Memberships',match.id,{failedAttempts:attempts,lockedUntil:lockUntil});
      fail_('AUTH_FAILED','World code, player name, or PIN is incorrect.');
    }
    patch_('Memberships',match.id,{failedAttempts:0,lockedUntil:''});
    return sessionResponse_(world,player,match);
  });
}

function logout_(body) {
  const ctx = auth_(body.token);
  const session = first_('Sessions',function(x){return x.tokenHash === hashText_(body.token) && !x.revokedAt;});
  if (session) patch_('Sessions',session.id,{revokedAt:now_()});
  audit_(ctx.world.id,ctx.player.id,'auth.logout','Session',session ? session.id : '',null,null);
  return {loggedOut:true};
}

function sessionResponse_(world,player,membership) {
  const token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
  append_('Sessions',{id:uuid_(),tokenHash:hashText_(token),worldId:world.id,playerId:player.id,expiresAt:expiresAt,revokedAt:'',createdAt:now_()});
  return {
    token:token,expiresAt:expiresAt,
    world:{id:world.id,name:world.name,joinCode:world.joinCode,gameVersion:world.gameVersion,difficulty:world.difficulty,evilBiome:world.evilBiome,seed:world.seed},
    player:{id:player.id,name:player.name,gameClass:membership.gameClass,role:membership.role}
  };
}

function makeMembership_(worldId,playerId,gameClass,role,pin,createdAt) {
  const salt = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  return {id:uuid_(),worldId:worldId,playerId:playerId,gameClass:gameClass,role:role,
    pinSalt:salt,pinHash:hashPin_(pin,salt),failedAttempts:0,lockedUntil:'',createdAt:createdAt};
}

function auth_(token) {
  if (typeof token !== 'string' || token.length < 40 || token.length > 200) fail_('UNAUTHORIZED','A valid session token is required.');
  const tokenHash = hashText_(token);
  const session = first_('Sessions',function(x){return x.tokenHash === tokenHash;});
  if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
    fail_('UNAUTHORIZED','Session is invalid or expired. Sign in again.');
  }
  const world = first_('Worlds',function(x){return x.id === session.worldId && x.status === 'active';});
  const membership = first_('Memberships',function(x){return x.worldId === session.worldId && x.playerId === session.playerId;});
  const player = first_('Players',function(x){return x.id === session.playerId;});
  if (!world || !membership || !player) fail_('UNAUTHORIZED','World membership is no longer active.');
  return {session:session,world:world,membership:membership,player:player};
}

function worldInfo_(body) {
  const ctx = auth_(body.token);
  return {id:ctx.world.id,name:ctx.world.name,joinCode:ctx.world.joinCode,gameVersion:ctx.world.gameVersion,difficulty:ctx.world.difficulty,evilBiome:ctx.world.evilBiome,seed:ctx.world.seed};
}

function listPlayers_(body) {
  const ctx = auth_(body.token);
  return rows_('Memberships').filter(function(m){return m.worldId === ctx.world.id;}).map(function(m){
    const p = first_('Players',function(x){return x.id === m.playerId;});
    return p ? {id:p.id,name:p.name,gameClass:m.gameClass,role:m.role} : null;
  }).filter(Boolean);
}

/* ---------- Progress ---------- */

function listProgress_(body) {
  const ctx = auth_(body.token);
  return rows_('PlayerItems').filter(function(x){return x.worldId === ctx.world.id;});
}

function setProgress_(body) {
  const ctx = auth_(body.token);
  const itemId = identifier_(body.itemId,'itemId');
  const status = String(body.status || '');
  if (ITEM_STATUSES.indexOf(status) < 0) fail_('VALIDATION_ERROR','Unsupported item status.');
  const quantity = integer_(body.quantity === undefined ? 1 : body.quantity,'quantity',0,999);
  return locked_(function() {
    const current = first_('PlayerItems',function(x){return x.worldId === ctx.world.id && x.playerId === ctx.player.id && x.itemId === itemId;});
    const next = {id:current ? current.id : uuid_(),worldId:ctx.world.id,playerId:ctx.player.id,itemId:itemId,status:status,quantity:quantity,updatedAt:now_()};
    if (current) patch_('PlayerItems',current.id,next); else append_('PlayerItems',next);
    audit_(ctx.world.id,ctx.player.id,'progress.set','PlayerItem',itemId,current || null,next);
    return next;
  });
}

/* ---------- Boss progression ---------- */

function listBosses_(body) {
  const ctx = auth_(body.token);
  return rows_('WorldBosses').filter(function(x){return x.worldId === ctx.world.id;});
}

function setBossStatus_(body) {
  const ctx = auth_(body.token);
  const bossId = identifier_(body.bossId,'bossId');
  const status = String(body.status || '');
  if (status !== 'defeated' && status !== 'pending') fail_('VALIDATION_ERROR','Boss status must be defeated or pending.');
  return locked_(function() {
    const current = first_('WorldBosses',function(x){return x.worldId === ctx.world.id && x.bossId === bossId;});
    const next = {id:current ? current.id : uuid_(),worldId:ctx.world.id,bossId:bossId,status:status,defeatedAt:status === 'defeated' ? now_() : '',updatedBy:ctx.player.id};
    if (current) patch_('WorldBosses',current.id,next); else append_('WorldBosses',next);
    audit_(ctx.world.id,ctx.player.id,'boss.setStatus','Boss',bossId,current || null,next);
    return next;
  });
}

/* ---------- Shared inventory ---------- */

function listInventory_(body) {
  const ctx = auth_(body.token);
  return rows_('TeamInventory').filter(function(x){return x.worldId === ctx.world.id;});
}

function setInventory_(body) {
  const ctx = auth_(body.token);
  const itemId = identifier_(body.itemId,'itemId');
  const quantity = integer_(body.quantity,'quantity',0,99999);
  return locked_(function() {
    const current = first_('TeamInventory',function(x){return x.worldId === ctx.world.id && x.playerId === ctx.player.id && x.itemId === itemId;});
    const reserved = current ? Number(current.reservedQuantity || 0) : 0;
    if (quantity < reserved) fail_('INSUFFICIENT_STOCK','Quantity cannot be lower than the reserved amount.');
    const next = {id:current ? current.id : uuid_(),worldId:ctx.world.id,playerId:ctx.player.id,itemId:itemId,quantity:quantity,reservedQuantity:reserved,updatedAt:now_()};
    if (current) patch_('TeamInventory',current.id,next); else append_('TeamInventory',next);
    append_('InventoryTransactions',{id:uuid_(),worldId:ctx.world.id,playerId:ctx.player.id,itemId:itemId,delta:quantity-(current ? Number(current.quantity || 0) : 0),reason:'manual_set',idempotencyKey:'',createdAt:now_()});
    audit_(ctx.world.id,ctx.player.id,'inventory.set','TeamInventory',itemId,current || null,next);
    return next;
  });
}

function transferInventory_(body) {
  const ctx = auth_(body.token);
  const toPlayerId = identifier_(body.toPlayerId,'toPlayerId');
  const itemId = identifier_(body.itemId,'itemId');
  const quantity = integer_(body.quantity,'quantity',1,99999);
  const key = text_(body.idempotencyKey,'idempotencyKey',8,100);
  if (toPlayerId === ctx.player.id) fail_('VALIDATION_ERROR','Cannot transfer items to yourself.');
  return locked_(function() {
    const prior = first_('InventoryTransactions',function(x){return x.worldId === ctx.world.id && x.idempotencyKey === key;});
    if (prior) return {duplicate:true,transferId:prior.reason && prior.reason.indexOf('transfer:') === 0 ? prior.reason.slice(9) : ''};
    const targetMembership = first_('Memberships',function(x){return x.worldId === ctx.world.id && x.playerId === toPlayerId;});
    if (!targetMembership) fail_('PLAYER_NOT_FOUND','Target player is not a member of this world.');
    const source = first_('TeamInventory',function(x){return x.worldId === ctx.world.id && x.playerId === ctx.player.id && x.itemId === itemId;});
    const available = source ? Number(source.quantity || 0) - Number(source.reservedQuantity || 0) : 0;
    if (available < quantity) fail_('INSUFFICIENT_STOCK','Not enough unreserved items to transfer.');
    const target = first_('TeamInventory',function(x){return x.worldId === ctx.world.id && x.playerId === toPlayerId && x.itemId === itemId;});
    const transferId = uuid_(), now = now_();
    patch_('TeamInventory',source.id,{quantity:Number(source.quantity)-quantity,updatedAt:now});
    if (target) patch_('TeamInventory',target.id,{quantity:Number(target.quantity || 0)+quantity,updatedAt:now});
    else append_('TeamInventory',{id:uuid_(),worldId:ctx.world.id,playerId:toPlayerId,itemId:itemId,quantity:quantity,reservedQuantity:0,updatedAt:now});
    append_('ItemTransfers',{id:transferId,worldId:ctx.world.id,fromPlayerId:ctx.player.id,toPlayerId:toPlayerId,itemId:itemId,quantity:quantity,status:'completed',createdAt:now});
    append_('InventoryTransactions',{id:uuid_(),worldId:ctx.world.id,playerId:ctx.player.id,itemId:itemId,delta:-quantity,reason:'transfer:'+transferId,idempotencyKey:key,createdAt:now});
    append_('InventoryTransactions',{id:uuid_(),worldId:ctx.world.id,playerId:toPlayerId,itemId:itemId,delta:quantity,reason:'transfer_in:'+transferId,idempotencyKey:key+':in',createdAt:now});
    audit_(ctx.world.id,ctx.player.id,'inventory.transfer','ItemTransfer',transferId,null,{toPlayerId:toPlayerId,itemId:itemId,quantity:quantity});
    return {duplicate:false,transferId:transferId};
  });
}

/* ---------- Spreadsheet helpers ---------- */

function initializeSheets() {
  ensureSchema_();
  return 'Sheets initialized. Existing columns were preserved; missing columns were appended.';
}

function ensureSchema_() {
  const ss = spreadsheet_();
  Object.keys(SCHEMA).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const required = SCHEMA[name];
    if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
      sh.getRange(1,1,1,required.length).setValues([required]);
      sh.setFrozenRows(1);
      return;
    }
    const width = Math.max(sh.getLastColumn(),1);
    const headers = sh.getRange(1,1,1,width).getValues()[0].filter(function(x){return x !== '';});
    const missing = required.filter(function(x){return headers.indexOf(x) < 0;});
    if (missing.length) sh.getRange(1,width+1,1,missing.length).setValues([missing]);
    sh.setFrozenRows(1);
  });
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) fail_('CONFIGURATION_ERROR','Set SPREADSHEET_ID in Apps Script Project Settings → Script Properties.');
  return SpreadsheetApp.openById(id);
}

function rows_(name) {
  const sh = spreadsheet_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues(), headers = values[0];
  return values.slice(1).map(function(row) {
    const record = {};
    headers.forEach(function(key,index){if(key) record[key] = row[index];});
    return record;
  }).filter(function(record){return Object.keys(record).length > 0;});
}

function first_(name,predicate) {
  const all = rows_(name);
  for (let i=0;i<all.length;i++) if (predicate(all[i])) return all[i];
  return null;
}

function append_(name,record) {
  const sh = spreadsheet_().getSheetByName(name);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(function(key){return record[key] === undefined ? '' : record[key];}));
}

function patch_(name,id,changes) {
  const sh = spreadsheet_().getSheetByName(name);
  const values = sh.getDataRange().getValues(), headers = values[0];
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) fail_('SCHEMA_ERROR','Sheet ' + name + ' has no id column.');
  for (let r=1;r<values.length;r++) {
    if (String(values[r][idIndex]) === String(id)) {
      const merged = {};
      headers.forEach(function(key,i){if(key) merged[key] = values[r][i];});
      Object.keys(changes).forEach(function(key){merged[key] = changes[key];});
      sh.getRange(r+1,1,1,headers.length).setValues([headers.map(function(key){return merged[key] === undefined ? '' : merged[key];})]);
      return merged;
    }
  }
  fail_('NOT_FOUND','Record not found in ' + name + '.');
}

function audit_(worldId,actorId,action,entityType,entityId,beforeValue,afterValue) {
  append_('AuditLog',{id:uuid_(),worldId:worldId,actorId:actorId,action:action,entityType:entityType,entityId:entityId,
    beforeJson:beforeValue === null ? '' : JSON.stringify(beforeValue),
    afterJson:afterValue === null ? '' : JSON.stringify(afterValue),createdAt:now_()});
}

function locked_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) fail_('BUSY','The tracker is processing another update. Retry shortly.');
  try { return callback(); } finally { lock.releaseLock(); }
}

/* ---------- Validation and crypto ---------- */

function text_(value,name,min,max) {
  const s = String(value === undefined || value === null ? '' : value).trim();
  if (s.length < min || s.length > max) fail_('VALIDATION_ERROR',name + ' must contain ' + min + '–' + max + ' characters.');
  return s;
}
function pin_(value) {
  const s = String(value === undefined || value === null ? '' : value);
  if (!/^\d{6,12}$/.test(s)) fail_('VALIDATION_ERROR','PIN must contain 6–12 digits.');
  return s;
}
function gameClass_(value) {
  const s = String(value);
  if (CLASSES.indexOf(s) < 0) fail_('VALIDATION_ERROR','Unsupported game class.');
  return s;
}
function identifier_(value,name) {
  const s = String(value || '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(s)) fail_('VALIDATION_ERROR',name + ' has an invalid format.');
  return s;
}
function integer_(value,name,min,max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail_('VALIDATION_ERROR',name + ' must be an integer between ' + min + ' and ' + max + '.');
  return n;
}
function normalizeCode_(value) {
  const s = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (!/^[A-Z0-9]{8}$/.test(s)) fail_('VALIDATION_ERROR','World code must contain 8 letters or digits.');
  return s;
}
function newJoinCode_() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Utilities.getUuid()+Utilities.getUuid());
  let result = '';
  for (let i=0;i<8;i++) result += alphabet[(bytes[i] + 256) % alphabet.length];
  return result;
}
function hashPin_(pin,salt) { return hashText_(salt + ':' + pin); }
function hashText_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
function safeEqual_(a,b) {
  a = String(a || ''); b = String(b || '');
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length,b.length);
  for (let i=0;i<length;i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}
function uuid_() { return Utilities.getUuid(); }
function now_() { return new Date().toISOString(); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code,message) { const err = new Error(message); err.code = code; throw err; }
