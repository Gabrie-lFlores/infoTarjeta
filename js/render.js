// ── render.js ─────────────────────────────────────────────
// Lee el estado y actualiza el DOM. No modifica datos.

import { state } from './state.js';
import {
  fmt, fmtF, fmtFLarga,
  calcFechas, calcPagoMinimo,
  calcSaldoUsado, calcTotalCorteActual, calcMSI
} from './calculos.js';

export function render() {
  const cfg    = state.config;
  const usado  = calcSaldoUsado(state.transacciones, state.saldo);
  const limite = parseFloat(cfg.limite) || 0;

  // ── Header y métricas ──
  document.getElementById('hdr-sub').textContent = cfg.nombre;
  document.getElementById('m-usado').textContent = fmt(usado);
  document.getElementById('m-disp').textContent  = limite ? fmt(Math.max(0, limite - usado)) : '—';

  // ── Panel periodos ──
  if (cfg.diaCorte) {
    const { cortePasado, pagoLimite, corteProx, diasParaPago, diasParaCorte, inicioPeriodo }
      = calcFechas(cfg.diaCorte, cfg.diasPago);

    const saldoAnterior   = state.cortes.length ? state.cortes[state.cortes.length - 1].total : 0;
    const pagoMinimo      = calcPagoMinimo(saldoAnterior, limite);
    const cuotaMSI        = (state.msi || [])
      .filter(m => calcMSI(m).vigente)
      .reduce((s, m) => s + calcMSI(m).pagoMes, 0);
    const pagoMinimoTotal = pagoMinimo + cuotaMSI;

    // Días para pago (métrica superior)
    const mDias = document.getElementById('m-dias');
    mDias.textContent = diasParaPago > 0 ? diasParaPago + ' días' : '¡Vencido!';
    mDias.className   = 'metric-value ' +
      (diasParaPago <= 0 ? 'danger' : diasParaPago <= 2 ? 'danger' : 'warn');

    // Columna izquierda — periodo anterior
    document.getElementById('pa-corte').textContent        = fmtF(cortePasado);
    document.getElementById('pa-limite-pago').textContent  = fmtF(pagoLimite);
    document.getElementById('pa-total').textContent        = fmt(saldoAnterior);
    document.getElementById('pa-minimo').textContent       = fmt(pagoMinimo);
    document.getElementById('pa-sin-int').textContent      = fmt(saldoAnterior);
    document.getElementById('pa-minimo-total').textContent = fmt(pagoMinimoTotal);

    const diasEl = document.getElementById('pa-dias');
    if (diasParaPago > 5) {
      diasEl.textContent = `✅ ${diasParaPago} días para pagar`;
      diasEl.className   = 'periodo-dias ok';
    } else if (diasParaPago > 0) {
      diasEl.textContent = `⚠️ ¡${diasParaPago} día${diasParaPago > 1 ? 's' : ''} para pagar!`;
      diasEl.className   = 'periodo-dias urgente';
    } else if (diasParaPago === 0) {
      diasEl.textContent = '🚨 ¡Hoy vence el pago!';
      diasEl.className   = 'periodo-dias vencido';
    } else {
      diasEl.textContent = `❌ Vencido hace ${Math.abs(diasParaPago)} día${Math.abs(diasParaPago) > 1 ? 's' : ''}`;
      diasEl.className   = 'periodo-dias vencido';
    }

    // Columna derecha — periodo actual
    document.getElementById('pact-inicio').textContent = fmtF(inicioPeriodo);
    document.getElementById('pact-corte').textContent  = fmtF(corteProx);
    document.getElementById('pact-dias').textContent   = diasParaCorte + ' días';
    document.getElementById('pact-total').textContent  = fmt(Math.max(0, calcTotalCorteActual(state.transacciones)));
    const msiActivos = (state.msi || []).filter(m => calcMSI(m).vigente);
    document.getElementById('pact-meses').textContent  = msiActivos.length ? msiActivos.length + ' activa(s)' : '—';

    // ── Alertas ──
    renderAlertas(diasParaPago, pagoLimite);

  } else {
    document.getElementById('m-dias').textContent = '—';
    document.getElementById('alerts-zone').innerHTML = '';
    ['pa-corte','pa-limite-pago','pa-total','pa-minimo','pa-sin-int','pa-minimo-total',
     'pact-inicio','pact-corte','pact-dias','pact-total','pact-meses']
      .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    document.getElementById('pa-dias').textContent = 'Configura el día de corte';
    document.getElementById('pa-dias').className   = 'periodo-dias';
  }

  // ── Barra de límite ──
  renderBarraLimite(usado, limite);

  // ── Listas ──
  renderTransacciones();
  renderHistorialCortes();
  renderMSI();
  renderRecurrentes();

  // ── Inputs de configuración ──
  renderConfigInputs();
}

function renderAlertas(diasParaPago, pagoLimite) {
  const alerts = document.getElementById('alerts-zone');
  alerts.innerHTML = '';

  if (diasParaPago === 2)
    alerts.innerHTML += `<div class="alert-banner alert-warn">⚠️ <span><strong>Aviso:</strong> Fecha límite de pago en 2 días (${fmtFLarga(pagoLimite)}).</span></div>`;
  else if (diasParaPago === 1)
    alerts.innerHTML += `<div class="alert-banner alert-danger">🔔 <span><strong>¡Mañana vence tu pago!</strong> Fecha límite: ${fmtFLarga(pagoLimite)}.</span></div>`;
  else if (diasParaPago === 0)
    alerts.innerHTML += `<div class="alert-banner alert-danger">🚨 <span><strong>¡Hoy vence el pago!</strong> Realiza tu pago hoy.</span></div>`;
  else if (diasParaPago < 0)
    alerts.innerHTML += `<div class="alert-banner alert-danger">❌ <span><strong>Pago vencido.</strong> Venció el ${fmtFLarga(pagoLimite)}. Se aplicaron cargos por intereses.</span></div>`;

  const hoyStr  = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  const autos   = state.transacciones.filter(t => (t.esRec || t.esMSI) && t.fecha === hoyStr);
  const ints    = state.transacciones.filter(t => t.esInteres && t.fecha === hoyStr);

  if (autos.length)
    alerts.innerHTML += `<div class="alert-banner alert-info">🔄 <span>Se registraron ${autos.length} cargo(s) automático(s) hoy.</span></div>`;
  if (ints.length)
    alerts.innerHTML += `<div class="alert-banner alert-danger">💸 <span>Se aplicaron ${ints.length} cargo(s) de intereses y/o IVA hoy.</span></div>`;
}

function renderBarraLimite(usado, limite) {
  const section = document.getElementById('limit-bar-section');
  if (limite > 0) {
    const pct = Math.min(100, (usado / limite) * 100);
    const bar = document.getElementById('limit-bar');
    bar.style.width = pct + '%';
    bar.className   = 'bar-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warn' : '');
    document.getElementById('pct-label').textContent = pct.toFixed(1) + '% del límite utilizado';
    section.style.display = 'block';
  } else {
    section.style.display = 'none';
  }
}

function renderTransacciones() {
  const list = document.getElementById('txn-list');

  if (!state.transacciones.length) {
    list.innerHTML = '<div class="empty">Sin movimientos en este corte</div>';
    document.getElementById('corte-subtotal').style.display = 'none';
    document.getElementById('txn-count').textContent = '0';
    return;
  }

  list.innerHTML = [...state.transacciones].reverse().map((t, ri) => {
    const i      = state.transacciones.length - 1 - ri;
    const isPago = t.tipo === 'pago';

    let icon = '🛒', iconBg = '#eaf3fb';
    if (isPago)                                      { icon = '💳'; iconBg = '#eafaf1'; }
    else if (t.tipoInteres === 'ordinario')           { icon = '📊'; iconBg = '#fdecea'; }
    else if (t.tipoInteres === 'moratorio')           { icon = '⚠️'; iconBg = '#fdecea'; }
    else if (t.tipoInteres?.startsWith('iva'))        { icon = '🧾'; iconBg = '#fff3e0'; }
    else if (t.esMSI)                                { icon = '📅'; iconBg = '#f5eefa'; }
    else if (t.esRec)                                { icon = '🔄'; iconBg = '#fef9ec'; }

    let etiq = '';
    if (t.esRec)                             etiq = '<span class="badge badge-warn">domiciliación</span>';
    else if (t.esMSI)                        etiq = '<span class="badge badge-purple">MSI</span>';
    else if (t.tipoInteres === 'ordinario')   etiq = '<span class="badge badge-danger">interés ordinario</span>';
    else if (t.tipoInteres === 'moratorio')   etiq = '<span class="badge badge-danger">interés moratorio</span>';
    else if (t.tipoInteres === 'iva_ordinario') etiq = '<span class="badge badge-orange">IVA intereses</span>';
    else if (t.tipoInteres === 'iva_moratorio') etiq = '<span class="badge badge-orange">IVA moratorio</span>';

    const color = isPago ? '#1e8449' : (t.esInteres ? '#8B0000' : '#c0392b');

    return `<div class="txn-item">
      <div class="txn-icon" style="background:${iconBg}">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:2px">
          <span class="txn-concept">${t.concepto}</span>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${etiq}</div>
        <div class="txn-date">${t.fecha}</div>
      </div>
      <span style="font-size:15px;font-weight:700;color:${color};flex-shrink:0">${isPago ? '-' : '+'}${fmt(t.cantidad)}</span>
      <button class="del-btn" onclick="window._acciones.eliminarTxn(${i})">✕</button>
    </div>`;
  }).join('');

  const total = calcTotalCorteActual(state.transacciones);
  document.getElementById('corte-total-val').textContent = fmt(Math.max(0, total));
  document.getElementById('corte-subtotal').style.display = total > 0 ? 'block' : 'none';
  document.getElementById('txn-count').textContent =
    state.transacciones.filter(t => t.tipo === 'gasto').length;
}

function renderHistorialCortes() {
  const el = document.getElementById('cortes-list');
  if (!state.cortes.length) {
    el.innerHTML = '<div class="empty">No hay cortes anteriores</div>';
    return;
  }
  el.innerHTML = [...state.cortes].reverse().map((c, ri) => {
    const i    = state.cortes.length - 1 - ri;
    const txns = c.transacciones || [];
    return `<div class="corte-item">
      <div class="corte-header" onclick="window._acciones.toggleCorte(${i})">
        <div>
          <div style="font-size:14px;font-weight:600">Corte ${c.fecha}</div>
          <div style="font-size:12px;color:#888">${txns.filter(t => t.tipo==='gasto').length} gastos · ${txns.filter(t => t.tipo==='pago').length} pagos</div>
        </div>
        <span style="font-size:15px;font-weight:700;color:#c0392b">${fmt(c.total)}</span>
      </div>
      <div class="corte-body" id="cb-${i}">
        ${txns.map(t => `<div class="corte-txn">
          <span>${t.concepto}</span>
          <span style="color:${t.tipo==='pago'?'#1e8449':'#c0392b'}">${t.tipo==='pago'?'-':''}${fmt(t.cantidad)}</span>
        </div>`).join('') || '<div style="font-size:13px;color:#aaa;padding:8px 0">Sin detalle</div>'}
      </div>
    </div>`;
  }).join('');
}

function renderMSI() {
  const el     = document.getElementById('msi-list');
  const msiArr = state.msi || [];
  if (!msiArr.length) {
    el.innerHTML = '<div class="empty" style="padding:1rem">Sin compras a meses registradas</div>';
    return;
  }
  el.innerHTML = msiArr.map((m, i) => {
    const { pagoMes, fin, mesActual, vigente } = calcMSI(m);
    const estado = vigente
      ? `<span class="badge badge-success">Mes ${mesActual}/${m.meses}</span>`
      : `<span class="badge" style="background:#eee;color:#999">Terminada</span>`;
    return `<div class="msi-item" onclick="window._modales.abrirModalMSI(${i})">
      <div style="font-size:20px">📅</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${m.concepto}</div>
        <div style="font-size:12px;color:#888">${fmt(pagoMes)}/mes · hasta ${fmtF(fin)}</div>
      </div>
      ${estado}
      <span style="font-size:12px;color:#aaa">✏️</span>
    </div>`;
  }).join('');
}

function renderRecurrentes() {
  const el     = document.getElementById('rec-list');
  const recArr = state.recurrentes || [];
  if (!recArr.length) {
    el.innerHTML = '<div class="empty" style="padding:1rem">Sin cargos recurrentes configurados</div>';
    return;
  }
  el.innerHTML = recArr.map((r, i) => `<div class="rec-item" onclick="window._modales.abrirModalRec(${i})">
    <div style="font-size:20px">🔄</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:600">${r.concepto}</div>
      <div style="font-size:12px;color:#888">Día ${r.dia} · ${r.periodo} · ${fmt(r.cantidad)}</div>
    </div>
    <span class="badge badge-warn">${r.periodo}</span>
    <span style="font-size:12px;color:#aaa">✏️</span>
  </div>`).join('');
}

function renderConfigInputs() {
  const cfg = state.config;
  document.getElementById('cfg-nombre').value    = cfg.nombre || '';
  document.getElementById('cfg-limite').value    = cfg.limite || '';
  document.getElementById('cfg-dia-corte').value = cfg.diaCorte || '';
  document.getElementById('cfg-dias-pago').value = cfg.diasPago || 20;
  document.getElementById('cfg-tasa-ord').value  = cfg.tasaOrdinaria || '';
  document.getElementById('cfg-tasa-mor').value  = cfg.tasaMoratoria || '';
}

// ── Toast ──
export function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show';
  if (type === 'warn') {
    el.style.background  = '#fef9ec';
    el.style.color       = '#b7770d';
    el.style.borderColor = '#f9e4a0';
  } else {
    el.style.background  = '#eafaf1';
    el.style.color       = '#1e8449';
    el.style.borderColor = '#a9dfbf';
  }
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Previews en configuración ──
export function actualizarPreview() {
  const dia  = parseInt(document.getElementById('cfg-dia-corte').value);
  const dp   = parseInt(document.getElementById('cfg-dias-pago').value) || 20;
  const prev = document.getElementById('fechas-preview');
  if (!dia || dia < 1 || dia > 28) { prev.style.display = 'none'; return; }
  const hoy   = new Date();
  let corte   = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (corte <= hoy) corte = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);
  const pago  = new Date(corte); pago.setDate(pago.getDate() + dp);
  prev.style.display = 'block';
  prev.innerHTML = `ℹ️ Próximo corte: <strong>${fmtFLarga(corte)}</strong> · Límite de pago: <strong>${fmtFLarga(pago)}</strong>`;
}

export function actualizarPreviewMSI() {
  const monto = parseFloat(document.getElementById('msi-monto').value);
  const meses = parseInt(document.getElementById('msi-meses').value);
  const fecha = document.getElementById('msi-fecha-inicio').value;
  const prev  = document.getElementById('msi-preview');
  if (!monto || !meses || !fecha) { prev.style.display = 'none'; return; }
  const fin   = new Date(fecha + 'T12:00:00');
  fin.setMonth(fin.getMonth() + meses); fin.setDate(fin.getDate() - 1);
  prev.style.display = 'block';
  prev.innerHTML = `📅 Pago mensual: <strong>${fmt(monto / meses)}</strong> · Termina: <strong>${fmtFLarga(fin)}</strong>`;
}
