// ── acciones.js ───────────────────────────────────────────
// Responde a los clicks del usuario. Coordina state, calculos y render.

import { state, saveState, resetState, diagnosticoIndexedDB } from './state.js';
import { calcSaldoUsado, calcTotalCorteActual, fechaHoy } from './calculos.js';
import { render, toast, actualizarPreview, actualizarPreviewMSI } from './render.js';
import { checkRecurrentes, checkMSI } from './automaticos.js';

// ── Gastos ──
export async function agregarGasto() {
  const c = document.getElementById('inp-concepto').value.trim();
  const q = parseFloat(document.getElementById('inp-cantidad').value);
  if (!c || isNaN(q) || q <= 0) { toast('Completa concepto y cantidad', 'warn'); return; }
  state.transacciones.push({ tipo: 'gasto', concepto: c, cantidad: q, fecha: fechaHoy() });
  document.getElementById('inp-concepto').value = '';
  document.getElementById('inp-cantidad').value = '';
  await saveState(); render(); toast('✅ Gasto registrado');
  switchTab('historial');
}

// ── Pagos ──
export async function registrarPago() {
  const q = parseFloat(document.getElementById('inp-pago').value);
  if (isNaN(q) || q <= 0) { toast('Ingresa un monto válido', 'warn'); return; }
  state.transacciones.push({ tipo: 'pago', concepto: 'Pago realizado', cantidad: q, fecha: fechaHoy() });
  document.getElementById('inp-pago').value = '';
  await saveState(); render(); toast('✅ Pago registrado');
}

// ── Eliminar transacción ──
export async function eliminarTxn(i) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  state.transacciones.splice(i, 1);
  await saveState(); render(); toast('Movimiento eliminado');
}

// ── Cerrar corte ──
export async function cerrarCorte() {
  if (!state.transacciones.length) { toast('Sin movimientos para cerrar', 'warn'); return; }
  if (!confirm('¿Cerrar el corte actual?')) return;
  const total = Math.max(0, calcTotalCorteActual(state.transacciones));
  state.saldo = calcSaldoUsado(state.transacciones, state.saldo);
  state.cortes.push({ fecha: fechaHoy(), total, transacciones: [...state.transacciones] });
  state.transacciones = [];
  await saveState(); render(); toast('✅ Corte cerrado');
  switchTab('cortes');
}

// ── Guardar configuración ──
export async function guardarConfig() {
  state.config.nombre        = document.getElementById('cfg-nombre').value.trim() || 'Mi tarjeta';
  state.config.limite        = parseFloat(document.getElementById('cfg-limite').value) || 0;
  state.config.diaCorte      = parseInt(document.getElementById('cfg-dia-corte').value) || 0;
  state.config.diasPago      = parseInt(document.getElementById('cfg-dias-pago').value) || 20;
  state.config.tasaOrdinaria = parseFloat(document.getElementById('cfg-tasa-ord').value) || 0;
  state.config.tasaMoratoria = parseFloat(document.getElementById('cfg-tasa-mor').value) || 0;
  await saveState(); render(); toast('✅ Configuración guardada');
}

// ── MSI: agregar ──
export async function agregarMSI() {
  const concepto    = document.getElementById('msi-concepto').value.trim();
  const monto       = parseFloat(document.getElementById('msi-monto').value);
  const meses       = parseInt(document.getElementById('msi-meses').value);
  const fechaInicio = document.getElementById('msi-fecha-inicio').value;
  if (!concepto || isNaN(monto) || monto <= 0 || !meses || !fechaInicio) {
    toast('Completa todos los campos de la compra a meses', 'warn'); return;
  }
  state.msi.push({ id: Date.now(), concepto, monto, meses, fechaInicio });
  document.getElementById('msi-concepto').value     = '';
  document.getElementById('msi-monto').value        = '';
  document.getElementById('msi-meses').value        = '';
  document.getElementById('msi-fecha-inicio').value = '';
  document.getElementById('msi-preview').style.display = 'none';
  checkMSI();
  await saveState(); render(); toast('✅ Compra a meses registrada');
}

// ── Recurrentes: agregar ──
export async function agregarRecurrente() {
  const c       = document.getElementById('rec-concepto').value.trim();
  const q       = parseFloat(document.getElementById('rec-cantidad').value);
  const dia     = parseInt(document.getElementById('rec-dia').value);
  const periodo = document.getElementById('rec-periodo').value;
  if (!c || isNaN(q) || q <= 0 || !dia || dia < 1 || dia > 28) {
    toast('Completa todos los campos', 'warn'); return;
  }
  state.recurrentes.push({ id: Date.now(), concepto: c, cantidad: q, dia, periodo });
  document.getElementById('rec-concepto').value = '';
  document.getElementById('rec-cantidad').value = '';
  document.getElementById('rec-dia').value      = '';
  checkRecurrentes();
  await saveState(); render(); toast('✅ Cargo recurrente agregado');
}

// ── Historial: expandir corte ──
export function toggleCorte(i) {
  const el = document.getElementById('cb-' + i);
  if (el) el.classList.toggle('open');
}

// ── Exportar / Importar ──
export function exportarJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tarjeta_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importarJSON() {
  const input  = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json';
  input.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      Object.assign(state, parsed);
      if (!state.msi)                state.msi = [];
      if (!state.interesesAplicados) state.interesesAplicados = [];
      await saveState(); render(); toast('✅ Datos importados');
    } catch { toast('Archivo inválido', 'warn'); }
  };
  input.click();
}

// ── Diagnóstico ──
export async function mostrarDiagnostico() {
  const box = document.getElementById('diag-output');
  box.style.display = 'block';
  box.textContent   = 'Consultando IndexedDB…';
  box.textContent   = await diagnosticoIndexedDB();
}

// ── Reset ──
export async function resetearDatos() {
  if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return;
  await resetState(); render(); toast('Datos eliminados');
}

// ── Tabs ──
export function switchTab(t) {
  const tabs = ['gastos', 'pagos', 'historial', 'cortes', 'config'];
  document.querySelectorAll('.tab').forEach((el, i) =>
    el.classList.toggle('active', tabs[i] === t));
  document.querySelectorAll('.tab-panel').forEach(el =>
    el.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
}

// ── Registrar listeners de previews ──
export function registrarListeners() {
  document.getElementById('cfg-dia-corte').addEventListener('input', actualizarPreview);
  document.getElementById('cfg-dias-pago').addEventListener('change', actualizarPreview);
  document.getElementById('msi-monto').addEventListener('input', actualizarPreviewMSI);
  document.getElementById('msi-meses').addEventListener('input', actualizarPreviewMSI);
  document.getElementById('msi-fecha-inicio').addEventListener('change', actualizarPreviewMSI);
}
