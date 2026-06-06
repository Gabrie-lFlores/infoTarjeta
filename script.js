// ── Estado ──
let state = {
  config: { nombre: 'Mi tarjeta', limite: 0, diaCorte: 5, diasPago: 20 },
  transacciones: [],
  cortes: [],
  saldo: 0,
  recurrentes: [],
  msi: []           // compras a meses sin intereses
};

// ── IndexedDB ──
const DB_NAME = 'SaldoTarjetaDB', DB_VER = 1, STORE = 'datos';

function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    r.onsuccess = e => res(e.target.result);
    r.onerror   = e => rej(e.target.error);
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
  }
}
async function loadState() {
  try {
    const db   = await abrirDB();
    const tx   = db.transaction(STORE, 'readonly');
    const req  = tx.objectStore(STORE).get('tc_v2');
    const data = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    db.close();
    if (data) state = JSON.parse(data);
  } catch(e) {
    try { const r = localStorage.getItem('tc_v2'); if (r) state = JSON.parse(r); } catch(_) {}
  }
  if (!state.msi) state.msi = [];
  if (!state.recurrentes) state.recurrentes = [];
  checkRecurrentes();
  checkMSI();
  render();
}

// ── Diagnóstico ──
async function mostrarDiagnostico() {
  const box = document.getElementById('diag-output');
  box.style.display = 'block';
  box.textContent = 'Consultando IndexedDB…';
  try {
    const db   = await abrirDB();
    const tx   = db.transaction(STORE, 'readonly');
    const req  = tx.objectStore(STORE).get('tc_v2');
    const data = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    db.close();
    if (!data) { box.textContent = '⚠ No hay datos en IndexedDB.'; return; }
    const o = JSON.parse(data);
    box.textContent =
      `✅ IndexedDB OK\n` +
      `Tarjeta    : ${o.config?.nombre}\n` +
      `Límite     : $${o.config?.limite}\n` +
      `Transacc.  : ${o.transacciones?.length}\n` +
      `Cortes     : ${o.cortes?.length}\n` +
      `Recurrentes: ${o.recurrentes?.length}\n` +
      `MSI        : ${o.msi?.length}\n` +
      `Tamaño     : ${(data.length/1024).toFixed(2)} KB`;
  } catch(e) { box.textContent = '❌ Error: ' + e.message; }
}

// ── Utilidades ──
function fmt(n) {
  return '$' + parseFloat(n||0).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fechaHoy() {
  return new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtF(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtFLarga(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
}

// ── Cálculo de fechas de corte ──
function calcFechas() {
  const hoy   = new Date();
  const dia   = parseInt(state.config.diaCorte) || 5;
  const diasP = parseInt(state.config.diasPago) || 20;
  // corte anterior (ya pasó)
  let cortePasado = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (cortePasado >= hoy) cortePasado = new Date(hoy.getFullYear(), hoy.getMonth()-1, dia);
  const pagoLimite = new Date(cortePasado);
  pagoLimite.setDate(pagoLimite.getDate() + diasP);
  // corte próximo
  let corteProx = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (corteProx <= hoy) corteProx = new Date(hoy.getFullYear(), hoy.getMonth()+1, dia);
  const msDay = 86400000;
  const diasParaPago  = Math.ceil((pagoLimite - hoy) / msDay);
  const diasParaCorte = Math.ceil((corteProx  - hoy) / msDay);
  // inicio del periodo actual = dia después del corte pasado
  const inicioPeriodo = new Date(cortePasado);
  inicioPeriodo.setDate(inicioPeriodo.getDate() + 1);
  return { cortePasado, pagoLimite, corteProx, diasParaPago, diasParaCorte, inicioPeriodo };
}

// ── Compras a meses sin intereses ──
function calcMSI(m) {
  const inicio   = new Date(m.fechaInicio + 'T12:00:00');
  const pagoMes  = m.monto / m.meses;
  const fin      = new Date(inicio);
  fin.setMonth(fin.getMonth() + m.meses);
  fin.setDate(fin.getDate() - 1);
  const hoy      = new Date();
  const mesActual = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth()) + 1;
  const mesActualClamp = Math.min(Math.max(mesActual, 1), m.meses);
  const vigente  = hoy <= fin;
  return { pagoMes, fin, mesActual: mesActualClamp, vigente };
}

function checkMSI() {
  if (!state.msi || !state.msi.length) return;
  const hoy     = new Date();
  const mesAnio = hoy.getFullYear() * 100 + hoy.getMonth();
  state.msi.forEach(m => {
    const { pagoMes, fin, mesActual, vigente } = calcMSI(m);
    if (!vigente) return;
    const key = 'msi_' + m.id + '_' + mesAnio;
    if (state.transacciones.some(t => t.recKey === key)) return;
    const diaCorte = parseInt(state.config.diaCorte) || 5;
    if (hoy.getDate() >= diaCorte) {
      state.transacciones.push({
        tipo: 'gasto',
        concepto: `${m.concepto} — MSI ${mesActual} de ${m.meses}`,
        cantidad: pagoMes,
        fecha: fechaHoy(),
        recKey: key,
        esMSI: true
      });
    }
  });
  // cerrar MSI vencidas automáticamente
  state.msi = state.msi.filter(m => {
    const { fin } = calcMSI(m);
    return hoy <= fin;
  });
}

function checkRecurrentes() {
  if (!state.recurrentes || !state.recurrentes.length) return;
  const hoy     = new Date();
  const dHoy    = hoy.getDate();
  const mesAnio = hoy.getFullYear() * 100 + hoy.getMonth();
  state.recurrentes.forEach(r => {
    const key = 'rec_' + r.id + '_' + mesAnio;
    if (state.transacciones.some(t => t.recKey === key)) return;
    let debe = false;
    if (r.periodo === 'mensual'    && dHoy >= parseInt(r.dia)) debe = true;
    if (r.periodo === 'bimestral'  && dHoy >= parseInt(r.dia) && hoy.getMonth() % 2 === 0) debe = true;
    if (r.periodo === 'trimestral' && dHoy >= parseInt(r.dia) && hoy.getMonth() % 3 === 0) debe = true;
    if (r.periodo === 'anual'      && dHoy >= parseInt(r.dia) && hoy.getMonth() === 0) debe = true;
    if (debe) {
      state.transacciones.push({
        tipo: 'gasto', concepto: r.concepto,
        cantidad: parseFloat(r.cantidad), fecha: fechaHoy(),
        recKey: key, esRec: true
      });
    }
  });
}

// ── Saldos ──
function saldoUsado() {
  const pagos  = state.transacciones.filter(t => t.tipo === 'pago').reduce((s,t) => s+t.cantidad, 0);
  const gastos = state.transacciones.filter(t => t.tipo === 'gasto').reduce((s,t) => s+t.cantidad, 0);
  return Math.max(0, state.saldo + gastos - pagos);
}
function totalCorteActual() {
  return state.transacciones.reduce((s,t) => s + (t.tipo==='gasto' ? t.cantidad : -t.cantidad), 0);
}

// ── Tabs ──
function switchTab(t) {
  const tabs = ['gastos','pagos','historial','cortes','config'];
  document.querySelectorAll('.tab').forEach((el,i) => el.classList.toggle('active', tabs[i]===t));
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
}

// ── Render ──
function render() {
  const cfg    = state.config;
  const usado  = saldoUsado();
  const limite = parseFloat(cfg.limite) || 0;

  document.getElementById('hdr-sub').textContent = cfg.nombre;
  document.getElementById('m-usado').textContent = fmt(usado);
  document.getElementById('m-disp').textContent  = limite ? fmt(Math.max(0, limite-usado)) : '—';

  // Panel periodos
  if (cfg.diaCorte) {
    const { cortePasado, pagoLimite, corteProx, diasParaPago, diasParaCorte, inicioPeriodo } = calcFechas();

    // Corte anterior (izquierda)
    const saldoAnterior = state.cortes.length ? state.cortes[state.cortes.length-1].total : 0;
    document.getElementById('pa-corte').textContent      = fmtF(cortePasado);
    document.getElementById('pa-limite-pago').textContent = fmtF(pagoLimite);
    document.getElementById('pa-total').textContent      = fmt(saldoAnterior);
    document.getElementById('pa-minimo').textContent     = fmt(saldoAnterior * 0.05);   // 5% mínimo MX
    document.getElementById('pa-sin-int').textContent    = fmt(saldoAnterior);           // pago total = sin intereses

    const diasEl = document.getElementById('pa-dias');
    if (diasParaPago > 2) {
      diasEl.textContent = `✅ ${diasParaPago} días para pagar`;
      diasEl.className = 'periodo-dias ok';
    } else if (diasParaPago > 0) {
      diasEl.textContent = `⚠️ ¡${diasParaPago} día${diasParaPago>1?'s':''} para pagar!`;
      diasEl.className = 'periodo-dias urgente';
    } else if (diasParaPago === 0) {
      diasEl.textContent = '🚨 ¡Hoy vence el pago!';
      diasEl.className = 'periodo-dias vencido';
    } else {
      diasEl.textContent = `❌ Vencido hace ${Math.abs(diasParaPago)} día${Math.abs(diasParaPago)>1?'s':''}`;
      diasEl.className = 'periodo-dias vencido';
    }

    // Días para pago en métrica
    const mDias = document.getElementById('m-dias');
    mDias.textContent = diasParaPago > 0 ? diasParaPago + ' días' : '¡Vencido!';
    mDias.className   = 'metric-value ' + (diasParaPago <= 0 ? 'danger' : diasParaPago <= 2 ? 'danger' : diasParaPago <= 5 ? 'warn' : 'warn');

    // Periodo actual (derecha)
    document.getElementById('pact-inicio').textContent  = fmtF(inicioPeriodo);
    document.getElementById('pact-corte').textContent   = fmtF(corteProx);
    document.getElementById('pact-dias').textContent    = diasParaCorte + ' días';
    document.getElementById('pact-total').textContent   = fmt(Math.max(0, totalCorteActual()));

    // MSI activos
    const msiActivos = (state.msi||[]).filter(m => calcMSI(m).vigente);
    document.getElementById('pact-meses').textContent = msiActivos.length ? msiActivos.length + ' activa(s)' : '—';

    // Alertas
    const alerts = document.getElementById('alerts-zone');
    alerts.innerHTML = '';
    if (diasParaPago === 2)
      alerts.innerHTML += `<div class="alert-banner alert-warn">⚠️ <span><strong>Aviso:</strong> Fecha límite de pago en 2 días (${fmtFLarga(pagoLimite)}).</span></div>`;
    else if (diasParaPago === 1)
      alerts.innerHTML += `<div class="alert-banner alert-danger">🔔 <span><strong>¡Mañana vence tu pago!</strong> Fecha límite: ${fmtFLarga(pagoLimite)}.</span></div>`;
    else if (diasParaPago <= 0)
      alerts.innerHTML += `<div class="alert-banner alert-danger">🚨 <span><strong>¡Pago vencido!</strong> Venció el ${fmtFLarga(pagoLimite)}. Realiza tu pago a la brevedad.</span></div>`;

    const autos = state.transacciones.filter(t => (t.esRec||t.esMSI) && t.fecha===fechaHoy());
    if (autos.length)
      alerts.innerHTML += `<div class="alert-banner alert-info">🔄 <span>Se registraron ${autos.length} cargo(s) automático(s) hoy.</span></div>`;
  } else {
    document.getElementById('m-dias').textContent = '—';
    document.getElementById('alerts-zone').innerHTML = '';
    ['pa-corte','pa-limite-pago','pa-total','pa-minimo','pa-sin-int',
     'pact-inicio','pact-corte','pact-dias','pact-total','pact-meses'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    document.getElementById('pa-dias').textContent = 'Configura el día de corte';
    document.getElementById('pa-dias').className = 'periodo-dias';
  }

  // Barra límite
  if (limite > 0) {
    const pct = Math.min(100, (usado/limite)*100);
    const bar = document.getElementById('limit-bar');
    bar.style.width = pct + '%';
    bar.className   = 'bar-fill' + (pct>90?' danger':pct>70?' warn':'');
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
    list.innerHTML = [...state.transacciones].reverse().map((t,ri) => {
      const i      = state.transacciones.length - 1 - ri;
      const isPago = t.tipo === 'pago';
      const icon   = isPago ? '💳' : (t.esMSI ? '📅' : t.esRec ? '🔄' : '🛒');
      const iconBg = isPago ? '#eafaf1' : t.esMSI ? '#f5eefa' : t.esRec ? '#fef9ec' : '#eaf3fb';
      const color  = isPago ? '#1e8449' : '#c0392b';
      const etiq   = t.esRec ? '<span class="badge badge-warn" style="margin-left:4px">domiciliación</span>'
                   : t.esMSI ? '<span class="badge badge-purple" style="margin-left:4px">MSI</span>'
                   : '';
      return `<div class="txn-item">
        <div class="txn-icon" style="background:${iconBg}">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px">
            <span class="txn-concept">${t.concepto}</span>${etiq}
          </div>
          <div class="txn-date">${t.fecha}</div>
        </div>
        <span style="font-size:14px;font-weight:600;color:${color};flex-shrink:0">${isPago?'-':'+'}${fmt(t.cantidad)}</span>
        <button class="del-btn" onclick="eliminarTxn(${i})">✕</button>
      </div>`;
    }).join('');
    const total = totalCorteActual();
    document.getElementById('corte-total-val').textContent = fmt(Math.max(0,total));
    document.getElementById('corte-subtotal').style.display = total > 0 ? 'block' : 'none';
  }
  document.getElementById('txn-count').textContent = state.transacciones.filter(t=>t.tipo==='gasto').length;

  // Historial cortes
  const cortesEl = document.getElementById('cortes-list');
  if (!state.cortes.length) {
    cortesEl.innerHTML = '<div class="empty">No hay cortes anteriores</div>';
  } else {
    cortesEl.innerHTML = [...state.cortes].reverse().map((c,ri) => {
      const i = state.cortes.length-1-ri;
      const txns = c.transacciones || [];
      return `<div class="corte-item">
        <div class="corte-header" onclick="toggleCorte(${i})">
          <div>
            <div style="font-size:13px;font-weight:600">Corte ${c.fecha}</div>
            <div style="font-size:11px;color:#888">${txns.filter(t=>t.tipo==='gasto').length} gastos · ${txns.filter(t=>t.tipo==='pago').length} pagos</div>
          </div>
          <span style="font-size:14px;font-weight:600;color:#c0392b">${fmt(c.total)}</span>
        </div>
        <div class="corte-body" id="cb-${i}">
          ${txns.map(t=>`<div class="corte-txn">
            <span>${t.concepto}</span>
            <span style="color:${t.tipo==='pago'?'#1e8449':'#c0392b'}">${t.tipo==='pago'?'-':''}${fmt(t.cantidad)}</span>
          </div>`).join('') || '<div style="font-size:12px;color:#aaa;padding:8px 0">Sin detalle</div>'}
        </div>
      </div>`;
    }).join('');
  }

  // MSI list
  const msiList = document.getElementById('msi-list');
  const msiArr  = state.msi || [];
  if (!msiArr.length) {
    msiList.innerHTML = '<div class="empty" style="padding:1rem">Sin compras a meses registradas</div>';
  } else {
    msiList.innerHTML = msiArr.map((m,i) => {
      const { pagoMes, fin, mesActual, vigente } = calcMSI(m);
      const estado = vigente
        ? `<span class="badge badge-success">Mes ${mesActual}/${m.meses}</span>`
        : `<span class="badge" style="background:#eee;color:#999">Terminada</span>`;
      return `<div class="msi-item" onclick="abrirModalMSI(${i})" title="Toca para editar">
        <div style="font-size:18px">📅</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500">${m.concepto}</div>
          <div style="font-size:11px;color:#888">${fmt(pagoMes)}/mes · hasta ${fmtF(fin)}</div>
        </div>
        ${estado}
        <span style="font-size:11px;color:#888">✏️</span>
      </div>`;
    }).join('');
  }

  // Recurrentes list
  const recArr  = state.recurrentes || [];
  const recList = document.getElementById('rec-list');
  if (!recArr.length) {
    recList.innerHTML = '<div class="empty" style="padding:1rem">Sin cargos recurrentes configurados</div>';
  } else {
    recList.innerHTML = recArr.map((r,i) => `<div class="rec-item" onclick="abrirModalRec(${i})" title="Toca para editar">
      <div style="font-size:18px">🔄</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${r.concepto}</div>
        <div style="font-size:11px;color:#888">Día ${r.dia} · ${r.periodo} · ${fmt(r.cantidad)}</div>
      </div>
      <span class="badge badge-warn">${r.periodo}</span>
      <span style="font-size:11px;color:#888">✏️</span>
    </div>`).join('');
  }

  // Config inputs
  document.getElementById('cfg-nombre').value    = cfg.nombre || '';
  document.getElementById('cfg-limite').value    = cfg.limite || '';
  document.getElementById('cfg-dia-corte').value = cfg.diaCorte || '';
  document.getElementById('cfg-dias-pago').value = cfg.diasPago || 20;
  actualizarPreview();
}

// ── Preview fechas ──
function actualizarPreview() {
  const dia  = parseInt(document.getElementById('cfg-dia-corte').value);
  const dp   = parseInt(document.getElementById('cfg-dias-pago').value) || 20;
  const prev = document.getElementById('fechas-preview');
  if (!dia || dia<1 || dia>28) { prev.style.display='none'; return; }
  const hoy  = new Date();
  let corte  = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (corte <= hoy) corte = new Date(hoy.getFullYear(), hoy.getMonth()+1, dia);
  const pago = new Date(corte); pago.setDate(pago.getDate()+dp);
  prev.style.display = 'block';
  prev.innerHTML = `ℹ️ Próximo corte: <strong>${fmtFLarga(corte)}</strong> · Fecha límite de pago: <strong>${fmtFLarga(pago)}</strong>`;
}

// ── Preview MSI ──
function actualizarPreviewMSI() {
  const monto = parseFloat(document.getElementById('msi-monto').value);
  const meses = parseInt(document.getElementById('msi-meses').value);
  const fecha = document.getElementById('msi-fecha-inicio').value;
  const prev  = document.getElementById('msi-preview');
  if (!monto || !meses || !fecha) { prev.style.display='none'; return; }
  const pagoMes = monto / meses;
  const inicio  = new Date(fecha + 'T12:00:00');
  const fin     = new Date(inicio); fin.setMonth(fin.getMonth()+meses); fin.setDate(fin.getDate()-1);
  prev.style.display = 'block';
  prev.innerHTML = `📅 Pago mensual: <strong>${fmt(pagoMes)}</strong> · Termina: <strong>${fmtFLarga(fin)}</strong>`;
}

document.getElementById('cfg-dia-corte').addEventListener('input', actualizarPreview);
document.getElementById('cfg-dias-pago').addEventListener('change', actualizarPreview);
document.getElementById('msi-monto').addEventListener('input', actualizarPreviewMSI);
document.getElementById('msi-meses').addEventListener('input', actualizarPreviewMSI);
document.getElementById('msi-fecha-inicio').addEventListener('change', actualizarPreviewMSI);

// ── Toast ──
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show';
  if (type==='warn') { el.style.background='#fef9ec'; el.style.color='#b7770d'; el.style.borderColor='#f9e4a0'; }
  else               { el.style.background='#eafaf1'; el.style.color='#1e8449'; el.style.borderColor='#a9dfbf'; }
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Acciones gastos / pagos ──
async function agregarGasto() {
  const c = document.getElementById('inp-concepto').value.trim();
  const q = parseFloat(document.getElementById('inp-cantidad').value);
  if (!c||isNaN(q)||q<=0) { toast('Completa concepto y cantidad','warn'); return; }
  state.transacciones.push({ tipo:'gasto', concepto:c, cantidad:q, fecha:fechaHoy() });
  document.getElementById('inp-concepto').value = '';
  document.getElementById('inp-cantidad').value = '';
  await saveState(); render(); toast('✅ Gasto registrado'); switchTab('historial');
}

async function registrarPago() {
  const q = parseFloat(document.getElementById('inp-pago').value);
  if (isNaN(q)||q<=0) { toast('Ingresa un monto válido','warn'); return; }
  state.transacciones.push({ tipo:'pago', concepto:'Pago realizado', cantidad:q, fecha:fechaHoy() });
  document.getElementById('inp-pago').value = '';
  await saveState(); render(); toast('✅ Pago registrado');
}

async function eliminarTxn(i) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  state.transacciones.splice(i,1);
  await saveState(); render(); toast('Movimiento eliminado');
}

async function cerrarCorte() {
  if (!state.transacciones.length) { toast('Sin movimientos para cerrar','warn'); return; }
  if (!confirm('¿Cerrar el corte actual?')) return;
  const total = Math.max(0, totalCorteActual());
  state.saldo = saldoUsado();
  state.cortes.push({ fecha:fechaHoy(), total, transacciones:[...state.transacciones] });
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

// ── MSI ──
async function agregarMSI() {
  const concepto    = document.getElementById('msi-concepto').value.trim();
  const monto       = parseFloat(document.getElementById('msi-monto').value);
  const meses       = parseInt(document.getElementById('msi-meses').value);
  const fechaInicio = document.getElementById('msi-fecha-inicio').value;
  if (!concepto||isNaN(monto)||monto<=0||!meses||!fechaInicio) {
    toast('Completa todos los campos de la compra a meses','warn'); return;
  }
  if (!state.msi) state.msi = [];
  state.msi.push({ id:Date.now(), concepto, monto, meses, fechaInicio });
  document.getElementById('msi-concepto').value    = '';
  document.getElementById('msi-monto').value       = '';
  document.getElementById('msi-meses').value       = '';
  document.getElementById('msi-fecha-inicio').value = '';
  document.getElementById('msi-preview').style.display = 'none';
  checkMSI();
  await saveState(); render(); toast('✅ Compra a meses registrada');
}

function abrirModalMSI(i) {
  const m = state.msi[i];
  document.getElementById('edit-msi-idx').value     = i;
  document.getElementById('edit-msi-concepto').value = m.concepto;
  document.getElementById('edit-msi-monto').value   = m.monto;
  document.getElementById('edit-msi-meses').value   = m.meses;
  document.getElementById('edit-msi-fecha').value   = m.fechaInicio;
  document.getElementById('modal-msi').style.display = 'flex';
}
function cerrarModalMSI(e) {
  if (!e || e.target === document.getElementById('modal-msi'))
    document.getElementById('modal-msi').style.display = 'none';
}
async function guardarMSI() {
  const i = parseInt(document.getElementById('edit-msi-idx').value);
  state.msi[i].concepto    = document.getElementById('edit-msi-concepto').value.trim();
  state.msi[i].monto       = parseFloat(document.getElementById('edit-msi-monto').value);
  state.msi[i].meses       = parseInt(document.getElementById('edit-msi-meses').value);
  state.msi[i].fechaInicio = document.getElementById('edit-msi-fecha').value;
  cerrarModalMSI();
  await saveState(); render(); toast('✅ Compra a meses actualizada');
}
async function eliminarMSIDesdeModal() {
  const i = parseInt(document.getElementById('edit-msi-idx').value);
  if (!confirm('¿Eliminar esta compra a meses?')) return;
  state.msi.splice(i,1);
  cerrarModalMSI();
  await saveState(); render(); toast('Compra a meses eliminada');
}

// ── Recurrentes ──
async function agregarRecurrente() {
  const c      = document.getElementById('rec-concepto').value.trim();
  const q      = parseFloat(document.getElementById('rec-cantidad').value);
  const dia    = parseInt(document.getElementById('rec-dia').value);
  const periodo = document.getElementById('rec-periodo').value;
  if (!c||isNaN(q)||q<=0||!dia||dia<1||dia>28) { toast('Completa todos los campos','warn'); return; }
  if (!state.recurrentes) state.recurrentes = [];
  state.recurrentes.push({ id:Date.now(), concepto:c, cantidad:q, dia, periodo });
  document.getElementById('rec-concepto').value = '';
  document.getElementById('rec-cantidad').value = '';
  document.getElementById('rec-dia').value      = '';
  checkRecurrentes();
  await saveState(); render(); toast('✅ Cargo recurrente agregado');
}

function abrirModalRec(i) {
  const r = state.recurrentes[i];
  document.getElementById('edit-rec-idx').value      = i;
  document.getElementById('edit-rec-concepto').value = r.concepto;
  document.getElementById('edit-rec-cantidad').value = r.cantidad;
  document.getElementById('edit-rec-dia').value      = r.dia;
  document.getElementById('edit-rec-periodo').value  = r.periodo;
  document.getElementById('modal-rec').style.display = 'flex';
}
function cerrarModalRec(e) {
  if (!e || e.target === document.getElementById('modal-rec'))
    document.getElementById('modal-rec').style.display = 'none';
}
async function guardarRecurrente() {
  const i = parseInt(document.getElementById('edit-rec-idx').value);
  state.recurrentes[i].concepto = document.getElementById('edit-rec-concepto').value.trim();
  state.recurrentes[i].cantidad = parseFloat(document.getElementById('edit-rec-cantidad').value);
  state.recurrentes[i].dia      = parseInt(document.getElementById('edit-rec-dia').value);
  state.recurrentes[i].periodo  = document.getElementById('edit-rec-periodo').value;
  cerrarModalRec();
  await saveState(); render(); toast('✅ Cargo recurrente actualizado');
}
async function eliminarRecDesdeModal() {
  const i = parseInt(document.getElementById('edit-rec-idx').value);
  if (!confirm('¿Eliminar este cargo recurrente?')) return;
  state.recurrentes.splice(i,1);
  cerrarModalRec();
  await saveState(); render(); toast('Cargo eliminado');
}

// ── Exportar / Importar ──
function exportarJSON() {
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tarjeta_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importarJSON() {
  const input  = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json';
  input.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      state = JSON.parse(await file.text());
      if (!state.msi) state.msi = [];
      await saveState(); render(); toast('✅ Datos importados');
    } catch { toast('Archivo inválido','warn'); }
  };
  input.click();
}

// ── Otras ──
function toggleCorte(i) {
  const el = document.getElementById('cb-'+i); if (el) el.classList.toggle('open');
}

async function resetearDatos() {
  if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return;
  state = { config:{nombre:'Mi tarjeta',limite:0,diaCorte:5,diasPago:20},
            transacciones:[], cortes:[], saldo:0, recurrentes:[], msi:[] };
  await saveState(); render(); toast('Datos eliminados');
}

// ── Inicio ──
loadState();
