// ── state.js ──────────────────────────────────────────────
// Estado global y persistencia con IndexedDB (+ fallback localStorage)

export let state = {
  config: {
    nombre: 'Mi tarjeta',
    limite: 0,
    diaCorte: 5,
    diasPago: 20,
    tasaOrdinaria: 0,
    tasaMoratoria: 0
  },
  transacciones: [],
  cortes: [],
  saldo: 0,
  recurrentes: [],
  msi: [],
  interesesAplicados: []
};

// ── IndexedDB ──
const DB_NAME = 'SaldoTarjetaDB';
const DB_VER  = 1;
const STORE   = 'datos';
const KEY     = 'tc_v2';

function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    r.onsuccess = e => res(e.target.result);
    r.onerror   = e => rej(e.target.error);
  });
}

export async function saveState() {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.stringify(state), KEY);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  } catch(e) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(_) {}
  }
}

export async function loadStateFromDB() {
  try {
    const db   = await abrirDB();
    const tx   = db.transaction(STORE, 'readonly');
    const req  = tx.objectStore(STORE).get(KEY);
    const data = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = rej;
    });
    db.close();
    if (data) Object.assign(state, JSON.parse(data));
  } catch(e) {
    try {
      const r = localStorage.getItem(KEY);
      if (r) Object.assign(state, JSON.parse(r));
    } catch(_) {}
  }
  // Garantizar campos nuevos en datos viejos
  if (!state.msi)                  state.msi = [];
  if (!state.recurrentes)          state.recurrentes = [];
  if (!state.interesesAplicados)   state.interesesAplicados = [];
  if (!state.config.tasaOrdinaria) state.config.tasaOrdinaria = 0;
  if (!state.config.tasaMoratoria) state.config.tasaMoratoria = 0;
}

export async function resetState() {
  Object.assign(state, {
    config: { nombre:'Mi tarjeta', limite:0, diaCorte:5, diasPago:20, tasaOrdinaria:0, tasaMoratoria:0 },
    transacciones: [], cortes: [], saldo: 0,
    recurrentes: [], msi: [], interesesAplicados: []
  });
  await saveState();
}

// ── Diagnóstico ──
export async function diagnosticoIndexedDB() {
  try {
    const db   = await abrirDB();
    const tx   = db.transaction(STORE, 'readonly');
    const req  = tx.objectStore(STORE).get(KEY);
    const data = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = rej;
    });
    db.close();
    if (!data) return '⚠ No hay datos en IndexedDB.';
    const o = JSON.parse(data);
    return (
      `✅ IndexedDB OK\n` +
      `Tarjeta    : ${o.config?.nombre}\n` +
      `Límite     : $${o.config?.limite}\n` +
      `Tasa ord.  : ${o.config?.tasaOrdinaria}% anual\n` +
      `Tasa mor.  : ${o.config?.tasaMoratoria}% anual\n` +
      `Transacc.  : ${o.transacciones?.length}\n` +
      `Cortes     : ${o.cortes?.length}\n` +
      `Recurrentes: ${o.recurrentes?.length}\n` +
      `MSI        : ${o.msi?.length}\n` +
      `Tamaño     : ${(data.length/1024).toFixed(2)} KB`
    );
  } catch(e) {
    return '❌ Error: ' + e.message;
  }
}
