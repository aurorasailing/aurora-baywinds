/**
 * Port Explorers — Attendance & Achievements  ·  sync endpoint (Apps Script web app)
 * Port Explorers Code.gs · PE v0.5
 * --------------------------------------------------------------------------
 * Standalone script (script.google.com) — same pattern as the PMYC Code.gs.
 * Logs two kinds of submission into ONE spreadsheet, each on its own tab:
 *   • Attendance   -> "Attendance"
 *   • Achievements -> "Achievements"
 * The request's "type" field routes it: "achievement" -> Achievements,
 * anything else -> Attendance. Each submission carries a unique id; a repeat
 * of the same id is ignored, so offline retries never double up.
 *
 * COLUMNS ARE MATCHED BY NAME. Each list below maps a payload field to a column
 * header. To add a field: add one line to the right list (and send the field
 * from the page). On the next submission the script adds any missing header to
 * the sheet itself and fills it — no manual sheet editing. Order here sets the
 * order for a freshly built tab; columns added to an existing tab land on the end.
 *
 * SET-UP (fresh start — nothing exists yet):
 *   1. script.google.com -> New project -> paste this in -> Save.
 *   2. Run > setup   (authorise it). Creates the spreadsheet + both tabs, logs
 *      the link (View > Execution log).
 *   3. Open that link. File > Import > Upload the roster xlsx > Insert new
 *      sheet(s). That adds the "Roster" tab beside Attendance & Achievements.
 *   4. Deploy > New deployment > Web app > Execute as Me, Access Anyone > Deploy.
 *      Copy the /exec URL into both logging pages (WEBAPP_URL).
 *   Any time later: Run > showSheet to re-print the link. setup() makes a NEW
 *   spreadsheet each run — run it once only.
 *
 * BINDING TO AN EXISTING SHEET INSTEAD: Project Settings (gear) > Script
 * Properties > add SHEET_ID = the long id from the sheet's URL. Then skip setup().
 *
 * EXPORT (read) ACCESS: the export page reads the data back, gated by a key.
 * Project Settings (gear) > Script Properties > add READ_KEY = a shared leader
 * key. Reads are refused until it's set. Writes (the logging pages) are never
 * gated. Re-deploy a new version after adding the key.
 *
 * VERSION: bump on every change. doGet returns it, so hitting the /exec URL in a
 * browser shows which version a deployment is actually running.
 */

var VERSION = 'PE v0.5';

var ATTEND_SHEET  = 'Attendance';
var ACHIEVE_SHEET = 'Achievements';

// [ payload field , column header ].  '_received' = server timestamp.
var ATTEND_COLS = [
  ['_received','Received'], ['date','Date'], ['time','Time'], ['group','Group'],
  ['sailor','Sailor'], ['loggedBy','Logged by'], ['note','Note'],
  ['deviceTime','Device time'], ['id','Submission ID'], ['device','Device']
];
var ACHIEVE_COLS = [
  ['_received','Received'], ['date','Date'], ['time','Time'], ['group','Group'],
  ['sailor','Sailor'], ['loggedBy','Logged by'],
  ['framework','Framework'], ['stage','Stage'], ['phase','Phase'], ['requirement','Requirement'],
  ['note','Note'], ['deviceTime','Device time'], ['id','Submission ID'], ['device','Device']
];


/* ---------- one-time set-up / admin (run from the editor) ---------- */

function setup(){
  var ss = SpreadsheetApp.create('Port Explorers — Attendance & Achievements');
  var sh = ss.getActiveSheet(); sh.setName(ATTEND_SHEET);
  writeHeader_(sh, headersOf_(ATTEND_COLS));
  writeHeader_(ss.insertSheet(ACHIEVE_SHEET), headersOf_(ACHIEVE_COLS));
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  Logger.log('Sheet created: ' + ss.getUrl());
}

function showSheet(){
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(!id){ Logger.log('No sheet yet — run setup() once.'); return; }
  tab_(ATTEND_SHEET); tab_(ACHIEVE_SHEET);
  Logger.log('Sheet (' + VERSION + '): ' + SpreadsheetApp.openById(id).getUrl());
}


/* ---------- endpoints ---------- */

function doPost(e){
  try{
    var data = JSON.parse(e.postData.contents);
    var type = data.type || 'attendance';
    var sh   = tab_(tabFor_(type));
    if(data.id && idExists_(sh, data.id)) return json_({ ok:true, dup:true, version:VERSION });
    logRow_(type, data);
    return json_({ ok:true, version:VERSION });
  }catch(err){
    return json_({ ok:false, error:String(err) });
  }
}

function doGet(e){
  var p = (e && e.parameter) || {};
  if(p.verify){
    var found = false;
    [ATTEND_SHEET, ACHIEVE_SHEET].forEach(function(n){
      var sh = book_().getSheetByName(n);
      if(sh && idExists_(sh, p.verify)) found = true;
    });
    return json_({ exists:found });
  }
  if(p['export']){
    if(!keyOK_(p.key)) return json_({ ok:false, error:'auth' });
    return json_({ ok:true, version:VERSION,
      attendance:   rowsOf_(ATTEND_SHEET),
      achievements: rowsOf_(ACHIEVE_SHEET) });
  }
  return json_({ version:VERSION });
}


/* ---------- helpers ---------- */

function headersOf_(cols){ var h=[]; for(var i=0;i<cols.length;i++) h.push(cols[i][1]); return h; }

function keyOK_(k){
  var want = PropertiesService.getScriptProperties().getProperty('READ_KEY');
  return !!want && String(k||'') === String(want);
}

function rowsOf_(name){
  var sh = book_().getSheetByName(name); if(!sh) return [];
  var last = sh.getLastRow(), lastCol = sh.getLastColumn(); if(last < 2) return [];
  var headers = sh.getRange(1,1,1,lastCol).getValues()[0];
  var data = sh.getRange(2,1,last-1,lastCol).getValues();
  return data.map(function(r){
    var o={}; for(var c=0;c<headers.length;c++){ var h=headers[c]; if(h!=='') o[h]=r[c]; } return o;
  });
}
function tabFor_(type){  return type==='achievement' ? ACHIEVE_SHEET : ATTEND_SHEET; }
function colsFor_(name){ return name===ACHIEVE_SHEET ? ACHIEVE_COLS : ATTEND_COLS; }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function book_(){
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(!id) throw new Error('Run setup() first.');
  return SpreadsheetApp.openById(id);
}

function writeHeader_(sh, headers){
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
}

function tab_(name){
  var ss = book_(); var sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); writeHeader_(sh, headersOf_(colsFor_(name))); }
  return sh;
}

function idExists_(sh, id){
  var last = sh.getLastRow(); if(last < 2) return false;
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var col = headers.indexOf('Submission ID'); if(col < 0) return false;
  var ids = sh.getRange(2, col+1, last-1, 1).getValues();
  for(var i=0;i<ids.length;i++){ if(String(ids[i][0]) === String(id)) return true; }
  return false;
}

function logRow_(type, data){
  var name = tabFor_(type);
  var sh   = tab_(name);
  var cols = colsFor_(name);

  var lastCol = sh.getLastColumn();
  var headers = lastCol ? sh.getRange(1,1,1,lastCol).getValues()[0] : [];
  if(!headers.length){ headers = headersOf_(cols); }

  var changed = false;
  for(var i=0;i<cols.length;i++){
    if(headers.indexOf(cols[i][1]) < 0){ headers.push(cols[i][1]); changed = true; }
  }
  if(changed || !lastCol) sh.getRange(1,1,1,headers.length).setValues([headers]);

  var byHeader = { 'Received': new Date() };
  for(var j=0;j<cols.length;j++){
    var field = cols[j][0], head = cols[j][1];
    if(field === '_received') continue;
    byHeader[head] = (field in data) ? data[field] : '';
  }
  var row = headers.map(function(h){ return (h in byHeader) ? byHeader[h] : ''; });
  sh.appendRow(row);
}
