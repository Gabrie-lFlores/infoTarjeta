let state = {
  config: { nombre: 'Mi tarjeta', limite: 0, diaCorte: 5, diasPago: 20 },
  transacciones: [],
  cortes: [],
  saldo: 0,
  recurrentes: []
};

// ── IndexedDB ──
const DB_NAME = 'SaldoTarjetaDB';
const DB_VERSION = 1;
const STORE = 'datos';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function saveState() {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.stringify(state), 'tc_v2');
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  } catch(e) {
    try { localStorage.setItem('tc_v2', JSON.stringify(state)); } catch(_) {}
    console.error('saveState error:', e);
  }
}

async function loadState() {
  try {
    const db = await abrirDB();
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('tc_v2');
    const data = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = rej;
    });
    db.close();
    if (data) state = JSON.parse(data);
  } catch(e) {
    try {
      const r = localStorage.getItem('tc_v2');
      if (r) state = JSON.parse(r);
    } catch(_) {}
    console.error('loadState error:', e);
  }
  checkRecurrentes();
  render();
}

// ── Diagnóstico IndexedDB ──
async function mostrarDiagnostico() {
  const box = document.getElementById('diag-output');
  box.textContent = 'Consultando IndexedDB…';
  try {
    const db   = await abrirDB();
    const tx   = db.transaction(STORE, 'readonly');
    const req  = tx.objectStore(STORE).get('tc_v2');
    const data = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = rej;
    });
    db.close();
    if (!data) { box.textContent = '⚠ No hay datos guardados en IndexedDB.'; return; }
    const obj = JSON.parse(data);
    box.textContent =
      `✅ IndexedDB OK\n` +
      `Tarjeta    : ${obj.config?.nombre}\n` +
      `Límite     : $${obj.config?.limite}\n` +
      `Saldo base : $${obj.saldo}\n` +
      `Transacc.  : ${obj.transacciones?.length}\n` +
      `Cortes     : ${obj.cortes?.length}\n` +
      `Recurrentes: ${obj.recurrentes?.length}\n` +
      `Tamaño     : ${(data.length / 1024).toFixed(2)} KB`;
  } catch(e) {
    box.textContent = '❌ Error: ' + e.message;
  }
}

// ── Utilidades ──
function fmt(n) {
  return '$' + parseFloat(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fechaHoy() {
  return new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function calcFechasCorte() {
  const hoy  = new Date();
  const dia  = parseInt(state.config.diaCorte) || 5;
  const diasP = parseInt(state.config.diasPago) || 20;
  let fCorte = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (fCorte > hoy)
    fCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 1, dia);
  const pago = new Date(fCorte);
  pago.setDate(pago.getDate() + diasP);
  const msDay = 86400000;
  const diasParaCorte = Math.ceil((fCorte - hoy) / msDay);
  const diasParaPago  = Math.ceil((pago - hoy) / msDay);
  return { fCorte, pago, diasParaCorte, diasParaPago };
}

function checkRecurrentes() {
  if (!state.recurrentes || !state.recurrentes.length) return;
  const hoy    = new Date();
  const dHoy   = hoy.getDate();
  const mesAnio = hoy.getFullYear() * 100 + hoy.getMonth();
  state.recurrentes.forEach(r => {
    const key = 'rec_' + r.id + '_' + mesAnio;
    if (state.transacciones.some(t => t.recKey === key)) return;
    let debeCargar = false;
    if (r.periodo === 'mensual'    && dHoy >= parseInt(r.dia)) debeCargar = true;
    if (r.periodo === 'bimestral'  && dHoy >= parseInt(r.dia) && hoy.getMonth() % 2 === 0) debeCargar = true;
    if (r.periodo === 'trimestral' && dHoy >= parseInt(r.dia) && hoy.getMonth() % 3 === 0) debeCargar = true;
    if (r.periodo === 'anual'      && dHoy >= parseInt(r.dia) && hoy.getMonth() === 0) debeCargar = true;
    if (debeCargar) {
      state.transacciones.push({
        tipo: 'gasto', concepto: r.concepto + ' (recurrente)',
        cantidad: parseFloat(r.cantidad), fecha: fechaHoy(), recKey: key, auto: true
      });
    }
  });
}

function saldoUsado() {
  const pagos  = state.transacciones.filter(t => t.tipo === 'pago').reduce((s, t) => s + t.cantidad, 0);
  const gastos = state.transacciones.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.cantidad, 0);
  return Math.max(0, state.saldo + gastos - pagos);
}
function totalCorteActual() {
  return state.transacciones.reduce((s, t) => s + (t.tipo === 'gasto' ? t.cantidad : -t.cantidad), 0);
}

function switchTab(t) {
  const tabs = ['gastos', 'pagos', 'historial', 'cortes', 'config'];
  document.querySelectorAll('.tab').forEach((el, i) =>
    el.classList.toggle('active', tabs[i] === t));
  document.querySelectorAll('.tab-panel').forEach(el =>
    el.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
}

// ── Render ──
function render() {
  const cfg   = state.config;
  document.getElementById('hdr-sub').textContent =
    cfg.nombre + (cfg.diaCorte ? ' · corte día ' + cfg.diaCorte : '');

  const usado  = saldoUsado();
  const limite = parseFloat(cfg.limite) || 0;
  document.getElementById('m-usado').textContent = fmt(usado);
  document.getElementById('m-disp').textContent  = limite ? fmt(Math.max(0, limite - usado)) : '—';

  const { fCorte, pago, diasParaPago } = calcFechasCorte();
  const mDias = document.getElementById('m-dias');
  mDias.textContent = cfg.diaCorte ? (diasParaPago > 0 ? diasParaPago + ' días' : '¡Hoy!') : '—';
  mDias.className   = 'metric-value ' + (diasParaPago <= 2 ? 'danger' : diasParaPago <= 5 ? 'warn' : 'warn');

  if (cfg.diaCorte) {
    document.getElementById('dc-corte').textContent     = fmtFecha(fCorte);
    document.getElementById('dc-corte-note').textContent = '';
    document.getElementById('dc-pago').textContent      = fmtFecha(pago);
    document.getElementById('dc-pago-note').textContent =
      'En ' + diasParaPago + ' día' + (diasParaPago !== 1 ? 's' : '');
  } else {
    document.getElementById('dc-corte').textContent      = '—';
    document.getElementById('dc-pago').textContent       = '—';
    document.getElementById('dc-corte-note').textContent = 'Configura el día de corte';
    document.getElementById('dc-pago-note').textContent  = '';
  }

  // Alertas
  const alerts = document.getElementById('alerts-zone');
  alerts.innerHTML = '';
  if (cfg.diaCorte) {
    if (diasParaPago === 2)
      alerts.innerHTML = `<div class="alert-banner alert-warn">⚠️ <span><strong>Aviso:</strong> Tu fecha límite de pago es en 2 días (${fmtFecha(pago)}). No olvides realizar tu pago.</span></div>`;
    else if (diasParaPago === 1)
      alerts.innerHTML = `<div class="alert-banner alert-danger">🔔 <span><strong>¡Mañana es tu fecha límite de pago!</strong> Paga antes del ${fmtFecha(pago)} para evitar cargos.</span></div>`;
    else if (diasParaPago === 0)
      alerts.innerHTML = `<div class="alert-banner alert-danger">🚨 <span><strong>¡Hoy es tu fecha límite de pago!</strong> Realiza tu pago a la brevedad.</span></div>`;

    const autos = state.transacciones.filter(t => t.auto && t.fecha === fechaHoy());
    if (autos.length)
      alerts.innerHTML += `<div class="alert-banner alert-info">🔄 <span>Se registraron automáticamente ${autos.length} cargo(s) recurrente(s) hoy.</span></div>`;
  }

  // Barra límite
  if (limite > 0) {
    const pct = Math.min(100, (usado / limite) * 100);
    const bar = document.getElementById('limit-bar');
    bar.style.width = pct + '%';
    bar.className   = 'bar-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warn' : '');
    document.getElementById('pct-label').textContent = pct.toFixed(1) + '% del límite utilizado';
    document.getElementById('limit-bar-section').style.display = 'block';
  } else {
    document.getElementById('limit-bar-section').style.display = 'none';
  }

  // Lista transacciones
  const list = document.getElementById('txn-list');
  if (!state.transacciones.length) {
    list.innerHTML = '<div class="empty">Sin movimientos en este corte</div>';
    document.getElementById('corte-subtotal').style.display = 'none';
  } else {
    list.innerHTML = [...state.transacciones].reverse().map((t, ri) => {
      const i       = state.transacciones.length - 1 - ri;
      const isPago  = t.tipo === 'pago';
      const iconBg  = isPago ? '#eafaf1' : '#eaf3fb';
      const iconClr = isPago ? '#1e8449' : '#1a6fa0';
      const icon    = isPago ? '💳' : (t.auto ? '🔄' : '🛒');
      const color   = isPago ? '#1e8449' : '#c0392b';
      const signo   = isPago ? '-' : '+';
      const autoBadge = t.auto ? '<span class="badge badge-warn" style="margin-left:4px">auto</span>' : '';
      return `<div class="txn-item">
        <div class="txn-icon" style="background:${iconBg};font-size:16px">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
            <span class="txn-concept">${t.concepto}</span>${autoBadge}
          </div>
          <div class="txn-date">${t.fecha}</div>
        </div>
        <span style="font-size:14px;font-weight:600;color:${color};flex-shrink:0">${signo}${fmt(t.cantidad)}</span>
        <button class="del-btn" onclick="eliminarTxn(${i})" aria-label="Eliminar">✕</button>
      </div>`;
    }).join('');
    const total = totalCorteActual();
    document.getElementById('corte-total-val').textContent = fmt(Math.max(0, total));
    document.getElementById('corte-subtotal').style.display = total > 0 ? 'block' : 'none';
  }
  document.getElementById('txn-count').textContent =
    state.transacciones.filter(t => t.tipo === 'gasto').length;

  // Historial cortes
  const cortesEl = document.getElementById('cortes-list');
  if (!state.cortes.length) {
    cortesEl.innerHTML = '<div class="empty">No hay cortes anteriores</div>';
  } else {
    cortesEl.innerHTML = [...state.cortes].reverse().map((c, ri) => {
      const i    = state.cortes.length - 1 - ri;
      const txns = c.transacciones || [];
      return `<div class="corte-item">
        <div class="corte-header" onclick="toggleCorte(${i})">
          <div>
            <div style="font-size:13px;font-weight:600;color:#1a1a1a">Corte ${c.fecha}</div>
            <div style="font-size:11px;color:#888">${txns.filter(t => t.tipo==='gasto').length} gastos · ${txns.filter(t => t.tipo==='pago').length} pagos</div>
          </div>
          <span style="font-size:14px;font-weight:600;color:#c0392b">${fmt(c.total)}</span>
        </div>
        <div class="corte-body" id="cb-${i}">
          ${txns.map(t => `<div class="corte-txn">
            <span>${t.concepto}${t.auto ? ' <em style="font-size:10px;color:#aaa">(auto)</em>' : ''}</span>
            <span style="color:${t.tipo==='pago'?'#1e8449':'#c0392b'}">${t.tipo==='pago'?'-':''}${fmt(t.cantidad)}</span>
          </div>`).join('') || '<div style="font-size:12px;color:#aaa;padding:8px 0">Sin detalle</div>'}
        </div>
      </div>`;
    }).join('');
  }

  // Recurrentes
  const recs    = state.recurrentes || [];
  const recList = document.getElementById('rec-list');
  if (!recs.length) {
    recList.innerHTML = '<div class="empty" style="padding:1rem">Sin cargos recurrentes configurados</div>';
  } else {
    recList.innerHTML = recs.map((r, i) => `<div class="recurrent-item">
      <div class="txn-icon" style="background:#fef9ec;font-size:16px">🔄</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:#1a1a1a">${r.concepto}</div>
        <div style="font-size:11px;color:#888">Día ${r.dia} · ${r.periodo} · ${fmt(r.cantidad)}</div>
      </div>
      <button class="del-btn" onclick="eliminarRec(${i})" aria-label="Eliminar">✕</button>
    </div>`).join('');
  }

  // Config inputs
  document.getElementById('cfg-nombre').value    = cfg.nombre || '';
  document.getElementById('cfg-limite').value    = cfg.limite || '';
  document.getElementById('cfg-dia-corte').value = cfg.diaCorte || '';
  document.getElementById('cfg-dias-pago').value = cfg.diasPago || 20;
  actualizarPreview();
}

function actualizarPreview() {
  const dia  = parseInt(document.getElementById('cfg-dia-corte').value);
  const dp   = parseInt(document.getElementById('cfg-dias-pago').value) || 20;
  const prev = document.getElementById('fechas-preview');
  if (!dia || dia < 1 || dia > 28) { prev.style.display = 'none'; return; }
  const hoy  = new Date();
  let corte  = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (corte <= hoy) corte = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);
  const pago = new Date(corte);
  pago.setDate(pago.getDate() + dp);
  prev.style.display = 'block';
  prev.innerHTML = `ℹ️ Próximo corte: <strong>${fmtFecha(corte)}</strong> · Fecha límite de pago: <strong>${fmtFecha(pago)}</strong>`;
}

document.getElementById('cfg-dia-corte').addEventListener('input', actualizarPreview);
document.getElementById('cfg-dias-pago').addEventListener('change', actualizarPreview);

// ── Toast ──
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show';
  if (type === 'warn') {
    el.style.background   = '#fef9ec';
    el.style.color        = '#b7770d';
    el.style.borderColor  = '#f9e4a0';
  } else {
    el.style.background   = '#eafaf1';
    el.style.color        = '#1e8449';
    el.style.borderColor  = '#a9dfbf';
  }
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Acciones ──
async function agregarGasto() {
  const c = document.getElementById('inp-concepto').value.trim();
  const q = parseFloat(document.getElementById('inp-cantidad').value);
  if (!c || isNaN(q) || q <= 0) { toast('Completa concepto y cantidad', 'warn'); return; }
  state.transacciones.push({ tipo: 'gasto', concepto: c, cantidad: q, fecha: fechaHoy() });
  document.getElementById('inp-concepto').value = '';
  document.getElementById('inp-cantidad').value = '';
  await saveState(); render(); toast('✅ Gasto registrado'); switchTab('historial');
}

async function registrarPago() {
  const q = parseFloat(document.getElementById('inp-pago').value);
  if (isNaN(q) || q <= 0) { toast('Ingresa un monto válido', 'warn'); return; }
  state.transacciones.push({ tipo: 'pago', concepto: 'Pago realizado', cantidad: q, fecha: fechaHoy() });
  document.getElementById('inp-pago').value = '';
  await saveState(); render(); toast('✅ Pago registrado');
}

async function eliminarTxn(i) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  state.transacciones.splice(i, 1);
  await saveState(); render(); toast('Movimiento eliminado');
}

async function cerrarCorte() {
  if (!state.transacciones.length) { toast('Sin movimientos para cerrar', 'warn'); return; }
  if (!confirm('¿Cerrar el corte actual?')) return;
  const total = Math.max(0, totalCorteActual());
  state.saldo = saldoUsado();
  state.cortes.push({ fecha: fechaHoy(), total, transacciones: [...state.transacciones] });
  state.transacciones = [];
  await saveState(); render(); toast('✅ Corte cerrado'); switchTab('cortes');
}

async function guardarConfig() {
  state.config.nombre   = document.getElementById('cfg-nombre').value.trim() || 'Mi tarjeta';
  state.config.limite   = parseFloat(document.getElementById('cfg-limite').value) || 0;
  state.config.diaCorte = parseInt(document.getElementById('cfg-dia-corte').value) || 0;
  state.config.diasPago = parseInt(document.getElementById('cfg-dias-pago').value) || 20;
  await saveState(); render(); toast('✅ Configuración guardada');
}

async function agregarRecurrente() {
  const c      = document.getElementById('rec-concepto').value.trim();
  const q      = parseFloat(document.getElementById('rec-cantidad').value);
  const dia    = parseInt(document.getElementById('rec-dia').value);
  const periodo = document.getElementById('rec-periodo').value;
  if (!c || isNaN(q) || q <= 0 || !dia || dia < 1 || dia > 28) {
    toast('Completa todos los campos', 'warn'); return;
  }
  if (!state.recurrentes) state.recurrentes = [];
  state.recurrentes.push({ id: Date.now(), concepto: c, cantidad: q, dia, periodo });
  document.getElementById('rec-concepto').value = '';
  document.getElementById('rec-cantidad').value = '';
  document.getElementById('rec-dia').value      = '';
  checkRecurrentes();
  await saveState(); render(); toast('✅ Cargo recurrente agregado');
}

async function eliminarRec(i) {
  if (!confirm('¿Eliminar este cargo recurrente?')) return;
  state.recurrentes.splice(i, 1);
  await saveState(); render(); toast('Cargo eliminado');
}

function toggleCorte(i) {
  const el = document.getElementById('cb-' + i);
  if (el) el.classList.toggle('open');
}

async function resetearDatos() {
  if (!confirm('¿Eliminar TODOS los datos?')) return;
  state = { config: { nombre: 'Mi tarjeta', limite: 0, diaCorte: 5, diasPago: 20 },
            transacciones: [], cortes: [], saldo: 0, recurrentes: [] };
  await saveState(); render(); toast('Datos eliminados');
}

// ── Exportar / Importar ──
function exportarJSON() {
  const datos = JSON.stringify(state, null, 2);
  const blob  = new Blob([datos], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `tarjeta_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarJSON() {
  const input  = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const texto = await file.text();
    try {
      state = JSON.parse(texto);
      await saveState(); render(); toast('✅ Datos importados correctamente');
    } catch(err) {
      toast('Archivo inválido', 'warn');
    }
  };
  input.click();
}

loadState();
