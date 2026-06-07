// ── modales.js ────────────────────────────────────────────
// Maneja los modales de edición de recurrentes y MSI.

import { state, saveState } from './state.js';
import { render, toast } from './render.js';

// ─────────────────────────────────────────
// Modal: Cargo recurrente
// ─────────────────────────────────────────
export function abrirModalRec(i) {
  const r = state.recurrentes[i];
  document.getElementById('edit-rec-idx').value      = i;
  document.getElementById('edit-rec-concepto').value = r.concepto;
  document.getElementById('edit-rec-cantidad').value = r.cantidad;
  document.getElementById('edit-rec-dia').value      = r.dia;
  document.getElementById('edit-rec-periodo').value  = r.periodo;
  document.getElementById('modal-rec').style.display = 'flex';
}

export function cerrarModalRec(e) {
  if (!e || e.target === document.getElementById('modal-rec'))
    document.getElementById('modal-rec').style.display = 'none';
}

export async function guardarRecurrente() {
  const i = parseInt(document.getElementById('edit-rec-idx').value);
  const concepto = document.getElementById('edit-rec-concepto').value.trim();
  const cantidad = parseFloat(document.getElementById('edit-rec-cantidad').value);
  const dia      = parseInt(document.getElementById('edit-rec-dia').value);
  const periodo  = document.getElementById('edit-rec-periodo').value;
  if (!concepto || isNaN(cantidad) || !dia) { toast('Completa todos los campos', 'warn'); return; }
  state.recurrentes[i] = { ...state.recurrentes[i], concepto, cantidad, dia, periodo };
  cerrarModalRec();
  await saveState(); render(); toast('✅ Cargo recurrente actualizado');
}

export async function eliminarRecDesdeModal() {
  const i = parseInt(document.getElementById('edit-rec-idx').value);
  if (!confirm('¿Eliminar este cargo recurrente?')) return;
  state.recurrentes.splice(i, 1);
  cerrarModalRec();
  await saveState(); render(); toast('Cargo eliminado');
}

// ─────────────────────────────────────────
// Modal: Compra a meses (MSI)
// ─────────────────────────────────────────
export function abrirModalMSI(i) {
  const m = state.msi[i];
  document.getElementById('edit-msi-idx').value      = i;
  document.getElementById('edit-msi-concepto').value = m.concepto;
  document.getElementById('edit-msi-monto').value    = m.monto;
  document.getElementById('edit-msi-meses').value    = m.meses;
  document.getElementById('edit-msi-fecha').value    = m.fechaInicio;
  document.getElementById('modal-msi').style.display = 'flex';
}

export function cerrarModalMSI(e) {
  if (!e || e.target === document.getElementById('modal-msi'))
    document.getElementById('modal-msi').style.display = 'none';
}

export async function guardarMSI() {
  const i        = parseInt(document.getElementById('edit-msi-idx').value);
  const concepto = document.getElementById('edit-msi-concepto').value.trim();
  const monto    = parseFloat(document.getElementById('edit-msi-monto').value);
  const meses    = parseInt(document.getElementById('edit-msi-meses').value);
  const fechaInicio = document.getElementById('edit-msi-fecha').value;
  if (!concepto || isNaN(monto) || !meses || !fechaInicio) {
    toast('Completa todos los campos', 'warn'); return;
  }
  state.msi[i] = { ...state.msi[i], concepto, monto, meses, fechaInicio };
  cerrarModalMSI();
  await saveState(); render(); toast('✅ Compra a meses actualizada');
}

export async function eliminarMSIDesdeModal() {
  const i = parseInt(document.getElementById('edit-msi-idx').value);
  if (!confirm('¿Eliminar esta compra a meses?')) return;
  state.msi.splice(i, 1);
  cerrarModalMSI();
  await saveState(); render(); toast('Compra a meses eliminada');
}
