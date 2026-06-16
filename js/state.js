// ── state.js v10 ──────────────────────────────────────────
const DB_NAME = 'SaldoTarjetaDB';
const DB_VER  = 3;
const STORE   = 'datos';
const KEY     = 'st_v10';

export const CATEGORIAS_GASTO = [
  'Alimentación','Vivienda','Transporte','Salud','Educación',
  'Entretenimiento','Tecnología','Servicios','Ahorro',
  'Inversión','Impuestos','AFORE','Seguro','Otro'
];

export const CATEGORIAS_TIPO = [
  { valor:'esencial',     label:'Esencial',     desc:'¿Lo necesito para vivir?' },
  { valor:'valioso',      label:'Valioso',       desc:'¿Me aporta bienestar real?' },
  { valor:'conveniencia', label:'Conveniencia',  desc:'¿Pago por ahorrar tiempo?' },
  { valor:'impulso',      label:'Impulso',       desc:'¿Lo compré sin planearlo?' },
  { valor:'estatus',      label:'Estatus',       desc:'¿Lo compré para impresionar?' }
];

// Agrupación de categorías para el presupuesto
export const GRUPOS_PRESUPUESTO = {
  'Hogar':        ['Vivienda','Servicios'],
  'Alimentación': ['Alimentación'],
  'Vehículo':     ['Transporte'],
  'Salud':        ['Salud','Seguro'],
  'Educación':    ['Educación'],
  'Finanzas':     ['Ahorro','Inversión','Impuestos','AFORE'],
  'Ocio':         ['Entretenimiento','Tecnología'],
  'Otros':        ['Otro']
};

export function nuevaTarjeta(nombre = 'Nueva tarjeta') {
  return {
    id: 'tc_' + Date.now(),
    nombre, limite: 0, diaCorte: 5, diasPago: 20,
    tasaOrdinaria: 0, tasaMoratoria: 0,
    transacciones: [], cortes: [], saldo: 0,
    recurrentes: [], msi: [], interesesAplicados: []
  };
}

export function nuevoMonedero(nombre = 'Efectivo') {
  return { id: 'mon_' + Date.now(), nombre, periodo: 'quincenal', transacciones: [], cortes: [] };
}

function presupuestoVacio() {
  const cats = {};
  CATEGORIAS_GASTO.forEach(c => { cats[c] = 0; });
  return { total: 0, categorias: cats };
}

export let state = {
  tarjetaActivaId:  null,
  monederoActivoId: null,
  tarjetas:  [ nuevaTarjeta('Mi tarjeta') ],
  monederos: [ nuevoMonedero('Efectivo')  ],
  presupuesto: presupuestoVacio()
};
state.tarjetaActivaId  = state.tarjetas[0].id;
state.monederoActivoId = state.monederos[0].id;

export function tarjetaActiva() {
  return state.tarjetas.find(t => t.id === state.tarjetaActivaId) || state.tarjetas[0];
}
export function monederoActivo() {
  return state.monederos.find(m => m.id === state.monederoActivoId) || state.monederos[0];
}

// ── IndexedDB ──
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
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
    const data = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    db.close();
    if (data) Object.assign(state, JSON.parse(data));
  } catch(e) {
    try { const r = localStorage.getItem(KEY); if (r) Object.assign(state, JSON.parse(r)); } catch(_) {}
  }
  if (!state.tarjetas?.length)  state.tarjetas  = [nuevaTarjeta()];
  if (!state.monederos?.length) state.monederos = [nuevoMonedero()];
  if (!state.tarjetaActivaId)   state.tarjetaActivaId  = state.tarjetas[0].id;
  if (!state.monederoActivoId)  state.monederoActivoId = state.monederos[0].id;
  if (!state.presupuesto)       state.presupuesto = presupuestoVacio();
  if (!state.presupuesto.categorias) state.presupuesto.categorias = presupuestoVacio().categorias;
  state.tarjetas.forEach(t => {
    if (!t.msi)               t.msi = [];
    if (!t.recurrentes)       t.recurrentes = [];
    if (!t.interesesAplicados) t.interesesAplicados = [];
    if (!t.cortes)            t.cortes = [];
    if (!t.transacciones)     t.transacciones = [];
  });
}

export async function resetState() {
  const tc  = nuevaTarjeta('Mi tarjeta');
  const mon = nuevoMonedero('Efectivo');
  Object.assign(state, {
    tarjetaActivaId: tc.id, monederoActivoId: mon.id,
    tarjetas: [tc], monederos: [mon], presupuesto: presupuestoVacio()
  });
  await saveState();
}

export async function diagnosticoIndexedDB() {
  try {
    const db   = await abrirDB();
    const tx   = db.transaction(STORE, 'readonly');
    const req  = tx.objectStore(STORE).get(KEY);
    const data = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    db.close();
    if (!data) return '⚠ No hay datos en IndexedDB.';
    const o = JSON.parse(data);
    return `✅ IndexedDB OK\nTarjetas  : ${o.tarjetas?.length}\nMonederos : ${o.monederos?.length}\nPresupuesto: $${o.presupuesto?.total || 0}\nTamaño    : ${(data.length/1024).toFixed(2)} KB`;
  } catch(e) { return '❌ Error: ' + e.message; }
}
