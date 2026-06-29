/* =====================================================================
   Tabellone Baskin - logica applicativa
   Autore: Daniele Lolli (UncleDan)
   PWA offline, due schermate: principale e impostazioni.
   ===================================================================== */
'use strict';

const APP_VERSION = '1.8.1';
const STORE_KEY = 'baskin-tabellone-v1';

/* ---------- Configurazione predefinita (modificabile da Impostazioni) ---------- */
const DEFAULT_CONFIG = {
  minutes: 8,            // durata di un periodo regolamentare (quarto)
  overtimeMinutes: 4,    // durata di un tempo supplementare
  periods: 4,            // numero di periodi regolamentari
  timeoutsPerHalf: 2,    // timeout per squadra in ciascun tempo (meta' gara): 1 per quarto, riportabili nella coppia di quarti
  timeoutsOvertime: 1,   // timeout per squadra in ogni supplementare
  bonus: 5,              // falli oltre i quali scatta il bonus
  autoBonusLast2: true,  // bonus automatico negli ultimi 2' di Q4 e supplementari
  manualFouls: false,    // conteggio falli manuale (tasti +/-): default disattivato
  resetFoulsEachPeriod: true,
  autoHorn: true
};

/* Durata (minuti / ms) del periodo indicato: i periodi oltre quelli
   regolamentari sono supplementari e durano overtimeMinutes. */
function periodMinutes(period){
  const c = state.config;
  return (period > c.periods) ? c.overtimeMinutes : c.minutes;
}
function periodFullMs(period){ return periodMinutes(period) * 60000; }

/* ---------- Timeout: raggruppamento per "fase" --------------------------
   I timeout sono 1 per quarto ma si riportano all'interno della stessa meta'
   gara: i quarti 1-2 condividono un monte (timeoutsPerHalf), cosi' come i
   quarti 3-4; ogni supplementare ha un monte a se' (timeoutsOvertime).      */
function phaseKey(period){
  const c = state.config;
  if(period > c.periods) return 'ot' + (period - c.periods);  // ogni supplementare separato
  const half = Math.ceil(c.periods / 2);
  return (period <= half) ? 'h1' : 'h2';                       // prima / seconda meta'
}
function timeoutPool(period){
  const c = state.config;
  return (period > c.periods) ? c.timeoutsOvertime : c.timeoutsPerHalf;
}

/* ---------- Stato della partita ---------- */
let state = loadState();

function freshState(cfg){
  const c = { ...DEFAULT_CONFIG, ...(cfg || {}) };
  return {
    config: c,
    period: 1,
    remainingMs: c.minutes * 60000,
    running: false,
    scores: [0, 0],
    fouls: [0, 0],
    timeoutsUsed: [0, 0],
    toPhase: 'h1',           // fase a cui si riferisce timeoutsUsed
    names: ['Squadra 1', 'Squadra 2']
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      s.config = { ...DEFAULT_CONFIG, ...(s.config || {}) };
      s.running = false;            // non si riprende mai "in corsa"
      if(!Array.isArray(s.names)) s.names = ['Squadra 1','Squadra 2'];
      if(!Array.isArray(s.timeoutsUsed)) s.timeoutsUsed = [0,0];
      if(typeof s.period !== 'number') s.period = 1;
      if(typeof s.toPhase !== 'string') s.toPhase = phaseKeyFor(s, s.period);
      return s;
    }
  }catch(e){ /* ignora */ }
  return freshState(DEFAULT_CONFIG);
}
/* variante di phaseKey utilizzabile prima che 'state' sia assegnato */
function phaseKeyFor(s, period){
  const c = s.config;
  if(period > c.periods) return 'ot' + (period - c.periods);
  const half = Math.ceil(c.periods / 2);
  return (period <= half) ? 'h1' : 'h2';
}

let muted = false;
try{ muted = localStorage.getItem(STORE_KEY+':muted') === '1'; }catch(e){}

let wakeWantedInit = false;
try{ wakeWantedInit = localStorage.getItem(STORE_KEY+':wake') === '1'; }catch(e){}

/* Salvataggio dello stato completo (partita + opzioni) ad ogni comando.
   Aggiunge un timestamp così, in caso di chiusura/crash, alla riapertura
   si riprende esattamente da qui (a orologio fermo). */
function saveState(){
  try{
    state.savedAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }catch(e){}
}

/* =====================================================================
   DISPLAY A 7 SEGMENTI (SVG generato)
   ===================================================================== */
const SEG_MAP = {
  '0':['a','b','c','d','e','f'],
  '1':['b','c'],
  '2':['a','b','g','e','d'],
  '3':['a','b','g','c','d'],
  '4':['f','g','b','c'],
  '5':['a','f','g','c','d'],
  '6':['a','f','g','e','c','d'],
  '7':['a','b','c'],
  '8':['a','b','c','d','e','f','g'],
  '9':['a','b','c','d','f','g'],
  ' ':[]
};

const SEG_POLY = buildSegmentPolygons();
function buildSegmentPolygons(){
  const W=100,H=180,p=11,ht=8,inset=5;
  const xL=p, xR=W-p, yA=p, yG=H/2, yD=H-p;
  const hx1=xL+inset, hx2=xR-inset;
  const horiz = (yc)=>[
    [hx1,yc],[hx1+ht,yc-ht],[hx2-ht,yc-ht],[hx2,yc],[hx2-ht,yc+ht],[hx1+ht,yc+ht]
  ];
  const vert = (xc,y1,y2)=>{
    const a=y1+inset, b=y2-inset;
    return [[xc,a],[xc+ht,a+ht],[xc+ht,b-ht],[xc,b],[xc-ht,b-ht],[xc-ht,a+ht]];
  };
  const toStr = pts => pts.map(p=>p.join(',')).join(' ');
  return {
    a: toStr(horiz(yA)),
    g: toStr(horiz(yG)),
    d: toStr(horiz(yD)),
    f: toStr(vert(xL,yA,yG)),
    b: toStr(vert(xR,yA,yG)),
    e: toStr(vert(xL,yG,yD)),
    c: toStr(vert(xR,yG,yD))
  };
}

function digitSVG(ch){
  const on = new Set(SEG_MAP[ch] || []);
  let polys = '';
  for(const seg of ['a','b','c','d','e','f','g']){
    const cls = on.has(seg) ? 'seg' : 'seg off';
    polys += `<polygon class="${cls}" points="${SEG_POLY[seg]}"/>`;
  }
  return `<svg class="seg-digit" viewBox="0 0 100 180" aria-hidden="true">${polys}</svg>`;
}

function colonSVG(){
  return `<svg class="seg-colon" viewBox="0 0 30 180" aria-hidden="true">`+
         `<circle class="dot" cx="15" cy="64" r="9"/>`+
         `<circle class="dot" cx="15" cy="116" r="9"/></svg>`;
}

/* punto decimale: usato per i decimi di secondo nell'ultimo minuto */
function dotSepSVG(){
  return `<svg class="seg-colon seg-dot" viewBox="0 0 30 180" aria-hidden="true">`+
         `<circle class="dot" cx="15" cy="150" r="10"/></svg>`;
}

function renderNumber(el, value){
  const s = String(value);
  el.innerHTML = [...s].map(digitSVG).join('');
}

/* =====================================================================
   RIFERIMENTI DOM
   ===================================================================== */
const $ = sel => document.querySelector(sel);
const body = document.body;
const elTimer = $('#timer');
const elPeriod = $('#period');
const elScore = [ $('#score1'), $('#score2') ];
const elFoul  = [ $('#foul1'),  $('#foul2')  ];
const elTO    = [ $('#timeouts1'), $('#timeouts2') ];
const elName  = [ $('#name1'), $('#name2') ];
const bonusLeft = $('#bonusLeft');
const bonusRight = $('#bonusRight');

/* campi nome modificabili + righe di correzione (iniettati) */
const nameInputs = [];
[0,1].forEach(i=>{
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'team-name-input';
  inp.maxLength = 18;
  elName[i].insertAdjacentElement('afterend', inp);
  inp.addEventListener('input', ()=>{ state.names[i] = inp.value; saveState(); });
  inp.addEventListener('blur', ()=>{ if(!inp.value.trim()){ inp.value = `Squadra ${i+1}`; state.names[i]=inp.value; saveState(); } });
  nameInputs.push(inp);
});

/* =====================================================================
   RENDER COMPLETO
   ===================================================================== */
function pad2(n){ return String(n).padStart(2,'0'); }

function mmss(ms){
  const t = Math.max(0, Math.ceil(ms/1000));
  return [ pad2(Math.floor(t/60)), pad2(t%60) ];
}

/* Regolamento FIBA: negli ultimi 60 secondi di ogni periodo o supplementare
   il cronometro mostra i decimi di secondo (SS.d invece di MM:SS). */
function renderTimer(){
  const ms = Math.max(0, state.remainingMs);
  const tenths = Math.ceil(ms / 100);            // decimi totali (0..600 nell'ultimo minuto)
  if(tenths >= 600){
    // 60,0 s o piu' -> formato MM:SS
    const [mm, ss] = mmss(ms);
    elTimer.classList.remove('tenths');
    elTimer.innerHTML = digitSVG(mm[0]) + digitSVG(mm[1]) + colonSVG() + digitSVG(ss[0]) + digitSVG(ss[1]);
  } else {
    // ultimo minuto -> formato SS.d con i decimi
    const ss = pad2(Math.floor(tenths / 10));
    const d  = String(tenths % 10);
    elTimer.classList.add('tenths');
    elTimer.innerHTML = digitSVG(ss[0]) + digitSVG(ss[1]) + dotSepSVG() + digitSVG(d);
  }
}

function renderAll(){
  renderTimer();
  if(state.period > state.config.periods){
    // tempo supplementare: mostra l'indice del supplementare con una "S"
    elPeriod.innerHTML = `${state.period - state.config.periods}<span class="ot-mark">TS</span>`;
  } else {
    elPeriod.innerHTML = `${state.period}&ordm;`;
  }
  for(let i=0;i<2;i++){
    renderNumber(elScore[i], state.scores[i]);
    renderNumber(elFoul[i], state.fouls[i]);
    elFoul[i].classList.toggle('limit', state.fouls[i] >= state.config.bonus);
    renderTimeouts(i);
    elName[i].textContent = state.names[i];
    nameInputs[i].value = state.names[i];
  }
  updateBonus();

  body.dataset.running = state.running ? 'true' : 'false';
  body.dataset.muted = muted ? 'true' : 'false';
  applyFoulMode();
}

/* Conteggio falli manuale: se attivo mostra contatori e tasti +/- dei falli,
   altrimenti resta solo l'etichetta "Falli" con le frecce del bonus. */
function applyFoulMode(){
  body.classList.toggle('manual-fouls', !!state.config.manualFouls);
}
function updateFoulLabel(){
  const el = $('#foulState'); if(el) el.textContent = state.config.manualFouls ? 'on' : 'off';
}

/* Bonus automatico negli ultimi 2' del quarto periodo regolamentare e di ogni
   supplementare: in quel caso il bonus vale per entrambe le squadre senza
   guardare il conteggio dei falli. */
function autoBonusActive(){
  const c = state.config;
  if(!c.autoBonusLast2) return false;
  const inFinalPhase = state.period >= c.periods;   // Q4 (== periods) o supplementari (> periods)
  return inFinalPhase && state.remainingMs <= 120000;
}
function updateBonus(){
  const auto = autoBonusActive();
  // la freccia punta verso la squadra che TIRA (avversaria di chi e' in penalita');
  // con bonus automatico si accendono entrambe.
  bonusLeft.classList.toggle('active',  auto || state.fouls[1] >= state.config.bonus);
  bonusRight.classList.toggle('active', auto || state.fouls[0] >= state.config.bonus);
  body.classList.toggle('auto-bonus', auto);
}

function renderTimeouts(i){
  const total = timeoutPool(state.period);
  const lit = state.timeoutsUsed[i];   // numero di pallini accesi (timeout chiamati)
  const wrap = elTO[i];
  wrap.innerHTML = '';
  if(total <= 0){ wrap.style.display='none'; return; }
  wrap.style.display = 'inline-flex';
  wrap.setAttribute('role', 'button');
  for(let d=0; d<total; d++){
    const dot = document.createElement('span');
    dot.className = 'to-dot' + (d < lit ? ' on' : '');
    wrap.appendChild(dot);
  }
}

/* =====================================================================
   MOTORE DEL TEMPO
   ===================================================================== */
let tickId = null;
let tickStart = 0;
let tickBase = 0;

function startClock(){
  if(state.running || state.remainingMs <= 0) return;
  state.running = true;
  tickBase = state.remainingMs;
  tickStart = performance.now();
  lastAutoBonus = autoBonusActive();
  lastTickSave = performance.now();
  body.dataset.running = 'true';
  tickId = setInterval(onTick, 100);
  saveState();
}

function stopClock(){
  if(tickId){ clearInterval(tickId); tickId = null; }
  if(state.running){
    state.remainingMs = Math.max(0, tickBase - (performance.now() - tickStart));
  }
  state.running = false;
  body.dataset.running = 'false';
  renderTimer();
  saveState();
}

let lastAutoBonus = false;
let lastTickSave = 0;
function onTick(){
  const rem = Math.max(0, tickBase - (performance.now() - tickStart));
  state.remainingMs = rem;
  renderTimer();
  // aggiorna il bonus automatico in tempo reale (entrata negli ultimi 2')
  const ab = autoBonusActive();
  if(ab !== lastAutoBonus){ updateBonus(); lastAutoBonus = ab; }
  // persistenza anti-crash: salva il tempo residuo ~ ogni secondo mentre scorre
  const now = performance.now();
  if(now - lastTickSave >= 1000){ saveState(); lastTickSave = now; }
  if(rem <= 0){
    stopClock();
    if(state.config.autoHorn) horn();
    toast('Fine tempo');
  }
}

function togglePlay(){
  if(state.running) stopClock(); else startClock();
}

/* =====================================================================
   AZIONI DI GIOCO
   ===================================================================== */
function addPoints(team, pts){
  state.scores[team] = Math.max(0, state.scores[team] + pts);
  renderNumber(elScore[team], state.scores[team]);
  saveState();
}

function addFoul(team, delta){
  if(!state.config.manualFouls) return;
  state.fouls[team] = Math.max(0, state.fouls[team] + delta);
  renderAll();
  saveState();
}

function tapTimeout(team){
  // un tocco accende un pallino in piu'; se sono tutti accesi, azzera
  const pool = timeoutPool(state.period);
  if(pool <= 0) return;
  let n = state.timeoutsUsed[team] + 1;
  if(n > pool) n = 0;
  state.timeoutsUsed[team] = n;
  renderTimeouts(team);
  saveState();
}

function applyPeriod(p){
  const max = state.config.periods + 9;   // fino a 9 tempi supplementari (1TS..9TS)
  p = Math.max(1, Math.min(max, p));
  state.period = p;
  // i timeout si riportano dentro la stessa meta' gara; si azzerano al cambio
  // fase (inizio seconda meta', ogni supplementare)
  const newPhase = phaseKey(p);
  if(newPhase !== state.toPhase){ state.timeoutsUsed = [0,0]; state.toPhase = newPhase; }
  if(state.config.resetFoulsEachPeriod){ state.fouls = [0,0]; }
  // ricarica il tempo pieno del nuovo periodo (regolamentare o supplementare), se l'orologio e' fermo
  if(!state.running){ state.remainingMs = periodFullMs(p); }
  renderAll();
  saveState();
  const label = (p > state.config.periods) ? `Supplementare ${p - state.config.periods}TS` : `Periodo ${p}`;
  toast(label);
}

function resetClock(){
  stopClock();
  state.remainingMs = periodFullMs(state.period);
  renderTimer();
  saveState();
  toast('Tempo azzerato');
}

function newGame(){
  stopClock();
  state = freshState(state.config);
  state.names = state.names || ['Squadra 1','Squadra 2'];
  renderAll();
  saveState();
  toast('Nuova partita');
}

/* Reset della sola partita: azzera punteggi, falli, timeout, tempo e periodo,
   mantenendo impostazioni e nomi squadra. */
function resetGame(){
  stopClock();
  const names = (state.names || ['Squadra 1','Squadra 2']).slice();
  const cfg = state.config;
  state = freshState(cfg);
  state.names = names;
  renderAll();
  saveState();
  toast('Partita azzerata');
}

/* =====================================================================
   AUDIO
   Suoni reali (file WAV originali, licenza CC0) in /sounds, con sintetizzatore
   di riserva via WebAudio se i file non sono disponibili.
   ===================================================================== */
let actx = null;
const SOUND_FILES = { horn: 'sounds/horn.wav', whistle: 'sounds/whistle.wav' };
const soundBuffers = { horn: null, whistle: null };
let soundsLoading = false;

function ensureAudio(){
  if(!actx){
    try{ actx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ actx = null; }
  }
  if(actx && actx.state === 'suspended'){ actx.resume(); }
  if(actx && !soundsLoading){ loadSounds(); }
  return actx;
}

async function loadSounds(){
  if(soundsLoading || !actx) return;
  soundsLoading = true;
  for(const key of Object.keys(SOUND_FILES)){
    if(soundBuffers[key]) continue;
    try{
      const res = await fetch(SOUND_FILES[key]);
      const buf = await res.arrayBuffer();
      soundBuffers[key] = await actx.decodeAudioData(buf);
    }catch(e){ /* si usera' il sintetizzatore di riserva */ }
  }
}

function playBuffer(key){
  const ctx = actx; if(!ctx) return false;
  const buf = soundBuffers[key]; if(!buf) return false;
  try{
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.95;
    src.connect(g); g.connect(ctx.destination);
    src.start();
    return true;
  }catch(e){ return false; }
}

/* sintetizzatori di riserva (nessun file) */
function beep(freq, start, dur, gainPeak, type){
  const ctx = actx; if(!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.value = freq;
  osc.connect(g); g.connect(ctx.destination);
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
  g.gain.setValueAtTime(gainPeak, t0 + dur - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function hornSynth(){ beep(311, 0.0, 1.0, 0.35, 'sawtooth'); beep(233, 0.0, 1.0, 0.30, 'sawtooth'); }
function whistleSynth(){
  const ctx = actx; if(!ctx) return;
  const osc = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  osc.type='sine'; osc.frequency.value=3100;
  lfo.type='sine'; lfo.frequency.value=22; lg.gain.value=90;
  lfo.connect(lg); lg.connect(osc.frequency);
  osc.connect(g); g.connect(ctx.destination);
  const t0=ctx.currentTime;
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(0.4,t0+0.02);
  g.gain.setValueAtTime(0.4,t0+0.45);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+0.55);
  lfo.start(t0); osc.start(t0); osc.stop(t0+0.6); lfo.stop(t0+0.6);
}

function horn(){
  if(muted) return;
  ensureAudio();
  if(!playBuffer('horn')) hornSynth();
}
function whistle(){
  if(muted) return;
  ensureAudio();
  if(!playBuffer('whistle')) whistleSynth();
}

/* =====================================================================
   MODALITA' IMPOSTAZIONI / GIOCO
   ===================================================================== */
function enterEdit(){
  stopClock();
  body.classList.remove('mode-game');
  body.classList.add('mode-edit');
}
function exitEdit(){
  // assicura nomi validi
  for(let i=0;i<2;i++){ if(!state.names[i].trim()) state.names[i] = `Squadra ${i+1}`; }
  body.classList.remove('mode-edit');
  body.classList.add('mode-game');
  renderAll();
  saveState();
  toast('Modifiche salvate');
}

/* =====================================================================
   FOGLI MODALI
   ===================================================================== */
function openSheet(id){ const el = document.getElementById(id); el.hidden = false; }
function closeSheet(id){ const el = document.getElementById(id); el.hidden = true; }

/* =====================================================================
   ROTORI (picker a rotella, con scroll-snap)
   ===================================================================== */
const ROTOR_ITEM_H = 44;   // deve combaciare con il CSS (.rotor-item height)

function buildRotor(el, values, initialIndex){
  el._values = values;
  el.innerHTML = '';
  values.forEach((v, idx)=>{
    const it = document.createElement('div');
    it.className = 'rotor-item';
    it.textContent = v;
    it.dataset.idx = idx;
    it.addEventListener('click', ()=> setRotorIndex(el, idx, true));
    el.appendChild(it);
  });
  setRotorIndex(el, initialIndex, false);
  if(!el._wired){
    let t = null;
    el.addEventListener('scroll', ()=>{
      clearTimeout(t);
      t = setTimeout(()=>{
        const i = Math.round(el.scrollTop / ROTOR_ITEM_H);
        setRotorIndex(el, i, false);
      }, 110);
    });
    el._wired = true;
  }
}
function setRotorIndex(el, idx, smooth){
  const n = (el._values ? el._values.length : 1);
  idx = Math.max(0, Math.min(n - 1, idx));
  el.dataset.idx = idx;
  const top = idx * ROTOR_ITEM_H;
  try{
    if(smooth && el.scrollTo){ el.scrollTo({ top, behavior:'smooth' }); }
    else { el.scrollTop = top; }
  }catch(e){ el.scrollTop = top; }
  const items = el.querySelectorAll('.rotor-item');
  items.forEach((it,i)=> it.classList.toggle('sel', i === idx));
}
function rotorIndex(el){ return parseInt(el.dataset.idx, 10) || 0; }
function rotorValue(el){ return el._values ? el._values[rotorIndex(el)] : null; }
function rangeStr(a, b){ const out=[]; for(let n=a;n<=b;n++) out.push(pad2(n)); return out; }

/* --- editor del tempo (rotori minuti / secondi / decimi) --- */
const rotorMin = () => $('#rotorMin');
const rotorSec = () => $('#rotorSec');
const rotorTenth = () => $('#rotorTenth');

function openTimeEditor(){
  const tenths = Math.round(state.remainingMs / 100);
  const mm = Math.floor(tenths / 600);
  const ss = Math.floor((tenths % 600) / 10);
  const dd = tenths % 10;
  buildRotor(rotorMin(),   rangeStr(0, 60), Math.min(60, mm));
  buildRotor(rotorSec(),   rangeStr(0, 59), ss);
  buildRotor(rotorTenth(), rangeStr(0, 9),  dd);
  openSheet('timeBackdrop');
}
function applyTimeEditor(){
  const mm = parseInt(rotorValue(rotorMin()), 10) || 0;
  const ss = parseInt(rotorValue(rotorSec()), 10) || 0;
  const dd = parseInt(rotorValue(rotorTenth()), 10) || 0;
  state.remainingMs = (mm * 60 + ss) * 1000 + dd * 100;
  closeSheet('timeBackdrop');
  renderTimer();
  saveState();
}
function timeEditorFull(){
  buildRotor(rotorMin(),   rangeStr(0, 60), periodMinutes(state.period));
  buildRotor(rotorSec(),   rangeStr(0, 59), 0);
  buildRotor(rotorTenth(), rangeStr(0, 9),  0);
}

/* --- editor del periodo (rotore 1..N, poi 1TS..9TS) --- */
const rotorPeriod = () => $('#rotorPeriod');
function periodValues(){
  const c = state.config;
  const v = [];
  for(let p=1; p<=c.periods; p++) v.push(String(p));
  for(let k=1; k<=9; k++) v.push(k + 'TS');
  return v;
}
function openPeriodEditor(){
  buildRotor(rotorPeriod(), periodValues(), state.period - 1);
  openSheet('periodBackdrop');
}
function applyPeriodEditor(){
  applyPeriod(rotorIndex(rotorPeriod()) + 1);
  closeSheet('periodBackdrop');
}

/* --- impostazioni partita --- */
function openSettings(){
  const c = state.config;
  $('#cfgMinutes').value = c.minutes;
  $('#cfgPeriods').value = c.periods;
  $('#cfgOvertime').value = c.overtimeMinutes;
  $('#cfgTimeoutsHalf').value = c.timeoutsPerHalf;
  $('#cfgTimeoutsOt').value = c.timeoutsOvertime;
  $('#cfgBonus').value = c.bonus;
  $('#cfgAutoBonus').checked = !!c.autoBonusLast2;
  $('#cfgResetFouls').checked = !!c.resetFoulsEachPeriod;
  $('#cfgAutoHorn').checked = !!c.autoHorn;
  openSheet('settingsBackdrop');
}
function saveSettings(){
  const num = (id, def, min, max)=>{
    let v = parseInt($(id).value, 10);
    if(isNaN(v)) v = def;
    return Math.min(max, Math.max(min, v));
  };
  state.config.minutes  = num('#cfgMinutes', 8, 1, 60);
  state.config.periods  = num('#cfgPeriods', 4, 1, 12);
  state.config.overtimeMinutes = num('#cfgOvertime', 4, 1, 30);
  state.config.timeoutsPerHalf = num('#cfgTimeoutsHalf', 2, 0, 9);
  state.config.timeoutsOvertime = num('#cfgTimeoutsOt', 1, 0, 9);
  state.config.bonus    = num('#cfgBonus', 5, 1, 20);
  state.config.autoBonusLast2 = $('#cfgAutoBonus').checked;
  state.config.resetFoulsEachPeriod = $('#cfgResetFouls').checked;
  state.config.autoHorn = $('#cfgAutoHorn').checked;
  // ricalibra i timeout gia' segnati sul nuovo monte della fase corrente
  const pool = timeoutPool(state.period);
  state.timeoutsUsed[0] = Math.min(state.timeoutsUsed[0], pool);
  state.timeoutsUsed[1] = Math.min(state.timeoutsUsed[1], pool);
  if(!state.running){ state.remainingMs = periodFullMs(state.period); }
  closeSheet('settingsBackdrop');
  renderAll();
  saveState();
  toast('Impostazioni salvate');
}

/* --- toast --- */
let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.hidden = true; }, 1600);
}

/* =====================================================================
   WAKE LOCK (schermo sempre acceso)
   ===================================================================== */
let wakeLock = null, wakeWanted = wakeWantedInit;
function persistWake(){ try{ localStorage.setItem(STORE_KEY+':wake', wakeWanted?'1':'0'); }catch(e){} }
async function toggleWake(){
  wakeWanted = !wakeWanted;
  persistWake();
  if(wakeWanted) await acquireWake(); else releaseWake();
  $('#wakeState').textContent = wakeWanted ? 'on' : 'off';
}
async function acquireWake(){
  try{
    if('wakeLock' in navigator){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', ()=>{});
    }
  }catch(e){ /* spesso richiede un gesto: si riproverà al primo tocco/visibilità */ }
}
function releaseWake(){ if(wakeLock){ wakeLock.release().catch(()=>{}); wakeLock = null; } }
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden'){ saveState(); return; }   // salva quando si va in background
  if(wakeWanted && document.visibilityState === 'visible'){ acquireWake(); }
});
window.addEventListener('pagehide', saveState);
window.addEventListener('beforeunload', saveState);

/* =====================================================================
   INSTALL PROMPT
   ===================================================================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  $('#actInstall').hidden = false;
});

/* =====================================================================
   VERIFICA AGGIORNAMENTI (PWA)
   Chiede al service worker di ricontrollare i file: se ne trova di nuovi,
   propone il ricaricamento per applicare la versione aggiornata.
   ===================================================================== */
async function checkForUpdates(){
  closeSheet('moreBackdrop');
  if(!('serviceWorker' in navigator)){ toast('Aggiornamenti non disponibili'); return; }
  let reg = null;
  try{ reg = await navigator.serviceWorker.getRegistration(); }catch(e){}
  if(!reg){ toast('Service worker non attivo'); return; }
  toast('Controllo aggiornamenti…');

  const promptReload = ()=>{
    if(confirm('È disponibile un aggiornamento. Ricaricare ora?')){
      if(reg.waiting){ reg.waiting.postMessage({ type:'SKIP_WAITING' }); }
      setTimeout(()=> location.reload(), 200);
    }
  };

  if(reg.waiting){ promptReload(); return; }

  let found = false;
  reg.addEventListener('updatefound', ()=>{
    found = true;
    const nw = reg.installing;
    if(!nw) return;
    nw.addEventListener('statechange', ()=>{
      if(nw.state === 'installed' && navigator.serviceWorker.controller){ promptReload(); }
    });
  });

  try{ await reg.update(); }catch(e){}
  setTimeout(()=>{ if(!found && !reg.waiting){ toast(`Sei aggiornato (v${APP_VERSION})`); } }, 1800);
}

/* =====================================================================
   EVENTI
   ===================================================================== */
function onActivate(el, handler){
  el.addEventListener('click', handler);
}

/* punti: +1/+2/+3 in gioco, -1/-2/-3 in modifica (data-pts puo' essere negativo) */
document.querySelectorAll('.side-buttons').forEach(group=>{
  const team = parseInt(group.dataset.team,10) - 1;
  group.querySelectorAll('.pts-btn').forEach(btn=>{
    onActivate(btn, ()=>{ ensureAudio(); addPoints(team, parseInt(btn.dataset.pts,10)); });
  });
});

/* timeout: un tocco sulla pillola accende un pallino in piu' (azzera se pieni) */
document.querySelector('.scores').addEventListener('click', (e)=>{
  const pill = e.target.closest('.timeouts');
  if(!pill) return;
  tapTimeout(parseInt(pill.dataset.team,10) - 1);
});

/* falli: + in operativa, - in impostazioni (attivi solo col conteggio falli on) */
document.querySelector('.fouls').addEventListener('click', (e)=>{
  const b = e.target.closest('.foul-btn');
  if(!b) return;
  addFoul(parseInt(b.dataset.team,10), parseInt(b.dataset.delta,10));
});

/* barra superiore */
onActivate($('#btnPlay'), ()=>{ if(body.classList.contains('mode-edit')) return; ensureAudio(); togglePlay(); });
onActivate($('#btnEdit'), enterEdit);
onActivate($('#btnConfirm'), exitEdit);

/* periodo: in modifica apre il selettore a rotore */
function periodTap(){ if(body.classList.contains('mode-edit')) openPeriodEditor(); }
elPeriod.addEventListener('click', periodTap);
elPeriod.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); periodTap(); }});

/* tempo: in modifica apre l'editor */
function timerTap(){ if(body.classList.contains('mode-edit')) openTimeEditor(); }
elTimer.addEventListener('click', timerTap);
elTimer.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); timerTap(); }});

/* nomi: in modifica, toccando la squadra (o il nome) si modifica il nome */
[0,1].forEach(i=>{
  const team = elName[i].closest('.team') || elName[i].parentElement;
  const focusName = ()=>{
    if(!body.classList.contains('mode-edit')) return;
    nameInputs[i].focus();
    nameInputs[i].select();
  };
  elName[i].addEventListener('click', focusName);
  team.addEventListener('click', (e)=>{
    // evita di rubare il focus quando si toccano i tasti -1/-2/-3, i timeout o il campo stesso
    if(e.target.closest('.pts-btn') || e.target.closest('.timeouts') || e.target === nameInputs[i]) return;
    focusName();
  });
});

/* sirena / fischietto (angolo in basso a destra) */
onActivate($('#btnHorn'), ()=>{ ensureAudio(); horn(); });
onActivate($('#btnWhistle'), ()=>{ ensureAudio(); whistle(); });

function updateMuteLabel(){
  const el = $('#muteState'); if(el) el.textContent = muted ? 'off' : 'on';
}
function toggleMute(){
  muted = !muted;
  body.dataset.muted = muted ? 'true':'false';
  try{ localStorage.setItem(STORE_KEY+':muted', muted?'1':'0'); }catch(e){}
  updateMuteLabel();
  toast(muted ? 'Suono disattivato' : 'Suono attivato');
}

function toggleManualFouls(){
  state.config.manualFouls = !state.config.manualFouls;
  if(!state.config.manualFouls){ state.fouls = [0,0]; }  // spegnendolo azzera i contatori
  updateFoulLabel();
  renderAll();
  saveState();
  toast(state.config.manualFouls ? 'Conteggio falli attivato' : 'Conteggio falli disattivato');
}

/* menu "..." (Informazioni + aggiornamenti) */
onActivate($('#btnMore'), ()=>{ updateMuteLabel(); updateFoulLabel(); openSheet('moreBackdrop'); });
onActivate($('#moreClose'), ()=> closeSheet('moreBackdrop'));
onActivate($('#actCheckUpdate'), checkForUpdates);
onActivate($('#actFouls'), toggleManualFouls);
onActivate($('#actMute'), toggleMute);
onActivate($('#actNewGame'), ()=>{ closeSheet('moreBackdrop'); if(confirm('Iniziare una nuova partita? Punteggi, falli e timeout verranno azzerati.')) newGame(); });
onActivate($('#actSettings'), ()=>{ closeSheet('moreBackdrop'); openSettings(); });
onActivate($('#actWake'), toggleWake);
onActivate($('#actInstall'), async ()=>{
  closeSheet('moreBackdrop');
  if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#actInstall').hidden = true; }
});

/* impostazioni */
onActivate($('#settingsSave'), saveSettings);
onActivate($('#settingsClose'), ()=> closeSheet('settingsBackdrop'));

/* editor tempo (rotori) */
onActivate($('#timeApply'), ()=>{ stopClock(); applyTimeEditor(); });
onActivate($('#timeFull'), timeEditorFull);
onActivate($('#timeClose'), ()=> closeSheet('timeBackdrop'));

/* editor periodo (rotore) */
onActivate($('#periodApply'), applyPeriodEditor);
onActivate($('#periodClose'), ()=> closeSheet('periodBackdrop'));

/* reset partita (basso a sinistra, solo in impostazioni) con conferma */
onActivate($('#btnReset'), ()=> openSheet('resetBackdrop'));
onActivate($('#resetConfirm'), ()=>{ closeSheet('resetBackdrop'); resetGame(); });
onActivate($('#resetCancel'), ()=> closeSheet('resetBackdrop'));

/* chiudi i fogli toccando lo sfondo */
document.querySelectorAll('.sheet-backdrop').forEach(bd=>{
  bd.addEventListener('click', (e)=>{ if(e.target === bd) bd.hidden = true; });
});

/* tasto spazio = play/pausa (comodo da tastiera/telecomando) */
document.addEventListener('keydown', (e)=>{
  if(e.code === 'Space' && body.classList.contains('mode-game') && !isTyping(e)){
    e.preventDefault(); ensureAudio(); togglePlay();
  }
});
function isTyping(e){ const t=e.target; return t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'); }

/* =====================================================================
   AVVIO
   ===================================================================== */
renderAll();

/* ripristina le preferenze salvate (schermo sempre acceso) */
{
  const ws = $('#wakeState'); if(ws) ws.textContent = wakeWanted ? 'on' : 'off';
  if(wakeWanted) acquireWake();
}

/* service worker per il funzionamento offline */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  });
}
