// ── main.js ───────────────────────────────────────────────
// Punto de entrada. Carga el estado, aplica automáticos,
// registra listeners y expone funciones al HTML vía window.

import { loadStateFromDB } from './state.js';
import { aplicarAutomaticos } from './automaticos.js';
import { render } from './render.js';
import {
  agregarGasto, registrarPago, eliminarTxn,
  cerrarCorte, guardarConfig,
  agregarMSI, agregarRecurrente,
  toggleCorte, exportarJSON, importarJSON,
  mostrarDiagnostico, resetearDatos,
  switchTab, registrarListeners
} from './acciones.js';
import {
  abrirModalRec, cerrarModalRec, guardarRecurrente, eliminarRecDesdeModal,
  abrirModalMSI, cerrarModalMSI, guardarMSI, eliminarMSIDesdeModal
} from './modales.js';

// ── Exponer funciones al HTML (onclick="...") ──
// Los módulos ES6 no son accesibles desde atributos onclick directamente,
// por lo que se exponen a través de window.
window._acciones = { eliminarTxn, toggleCorte };
window._modales  = { abrirModalRec, abrirModalMSI };

// Funciones llamadas directamente desde onclick en el HTML
Object.assign(window, {
  switchTab,
  agregarGasto,
  registrarPago,
  cerrarCorte,
  guardarConfig,
  agregarMSI,
  agregarRecurrente,
  exportarJSON,
  importarJSON,
  mostrarDiagnostico,
  resetearDatos,
  // modales recurrente
  cerrarModalRec,
  guardarRecurrente,
  eliminarRecDesdeModal,
  // modales MSI
  cerrarModalMSI,
  guardarMSI,
  eliminarMSIDesdeModal
});

// ── Inicialización ──
async function init() {
  await loadStateFromDB();
  await aplicarAutomaticos();
  registrarListeners();
  render();
}

init();
