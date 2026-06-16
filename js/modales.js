// ── modales.js v10 ────────────────────────────────────────
import { tarjetaActiva, saveState } from './state.js';
import { render, toast } from './render.js';

export function abrirModalRec(i) {
  const r = tarjetaActiva().recurrentes[i];
  document.getElementById('edit-rec-idx').value      = i;
  document.getElementById('edit-rec-concepto').value = r.concepto;
  document.getElementById('edit-rec-cantidad').value = r.cantidad;
  document.getElementById('edit-rec-dia').value      = r.dia;
  document.getElementById('edit-rec-periodo').value  = r.periodo;
  document.getElementById('modal-rec').classList.remove('hidden');
}
export function cerrarModalRec(e) {
  const modal = document.getElementById('modal-rec');
  if (!e || e.target === modal) modal.classList.add('hidden');
}
export async function guardarRecurrente() {
  const i        = parseInt(document.getElementById('edit-rec-idx').value);
  const tc       = tarjetaActiva();
  const concepto = document.getElementById('edit-rec-concepto').value.trim();
  const cantidad = parseFloat(document.getElementById('edit-rec-cantidad').value);
  const dia      = parseInt(document.getElementById('edit-rec-dia').value);
  const periodo  = document.getElementById('edit-rec-periodo').value;
  if (!concepto || isNaN(cantidad) || !dia) { toast('Completa todos los campos','warn'); return; }
  tc.recurrentes[i] = { ...tc.recurrentes[i], concepto, cantidad, dia, periodo };
  cerrarModalRec();
  await saveState(); render(); toast('✅ Cargo actualizado');
}
export async function eliminarRecDesdeModal() {
  const i = parseInt(document.getElementById('edit-rec-idx').value);
  if (!confirm('¿Eliminar este cargo recurrente?')) return;
  tarjetaActiva().recurrentes.splice(i, 1);
  cerrarModalRec();
  await saveState(); render(); toast('Cargo eliminado');
}

export function abrirModalMSI(i) {
  const m = tarjetaActiva().msi[i];
  document.getElementById('edit-msi-idx').value      = i;
  document.getElementById('edit-msi-concepto').value = m.concepto;
  document.getElementById('edit-msi-monto').value    = m.monto;
  document.getElementById('edit-msi-meses').value    = m.meses;
  document.getElementById('edit-msi-fecha').value    = m.fechaInicio;
  document.getElementById('modal-msi').classList.remove('hidden');
}
export function cerrarModalMSI(e) {
  const modal = document.getElementById('modal-msi');
  if (!e || e.target === modal) modal.classList.add('hidden');
}
export async function guardarMSI() {
  const i           = parseInt(document.getElementById('edit-msi-idx').value);
  const tc          = tarjetaActiva();
  const concepto    = document.getElementById('edit-msi-concepto').value.trim();
  const monto       = parseFloat(document.getElementById('edit-msi-monto').value);
  const meses       = parseInt(document.getElementById('edit-msi-meses').value);
  const fechaInicio = document.getElementById('edit-msi-fecha').value;
  if (!concepto || isNaN(monto) || !meses || !fechaInicio) { toast('Completa todos los campos','warn'); return; }
  tc.msi[i] = { ...tc.msi[i], concepto, monto, meses, fechaInicio };
  cerrarModalMSI();
  await saveState(); render(); toast('✅ MSI actualizada');
}
export async function eliminarMSIDesdeModal() {
  const i = parseInt(document.getElementById('edit-msi-idx').value);
  if (!confirm('¿Eliminar esta compra a meses?')) return;
  tarjetaActiva().msi.splice(i, 1);
  cerrarModalMSI();
  await saveState(); render(); toast('MSI eliminada');
}
