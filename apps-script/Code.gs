/**
 * Terraria Progress Tracker — Apps Script API starter.
 * Set SPREADSHEET_ID in Script Properties before deployment.
 * This starter intentionally refuses unauthenticated writes.
 */
const SHEETS = {
  Worlds: ['id','name','gameVersion','difficulty','evilBiome','seed','status','createdAt'],
  Players: ['id','name','createdAt'],
  Memberships: ['id','worldId','playerId','gameClass','role','pinSalt','pinHash','createdAt'],
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
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'health') return json_({success:true,data:{status:'ok',apiVersion:'v1'}});
  return json_({success:false,data:null,error:{code:'NOT_FOUND',message:'Unknown GET action'}});
}
function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.action === 'health') return json_({success:true,data:{status:'ok',apiVersion:'v1'}});
    return json_({success:false,data:null,error:{code:'NOT_IMPLEMENTED',message:'Configure authentication and implement this action before use'}});
  } catch (err) {
    return json_({success:false,data:null,error:{code:'BAD_REQUEST',message:String(err)}});
  }
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function initializeSheets() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Set SPREADSHEET_ID in Script Properties');
  const ss = SpreadsheetApp.openById(id);
  Object.keys(SHEETS).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
    else {
      const actual = sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),SHEETS[name].length)).getValues()[0];
      const missing = SHEETS[name].filter(h => !actual.includes(h));
      if (missing.length) throw new Error('Schema mismatch in '+name+': '+missing.join(', '));
    }
  });
}
