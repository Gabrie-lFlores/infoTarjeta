// ── main.js v10 ───────────────────────────────────────────
import { loadStateFromDB, state } from './state.js';
import { aplicarAutomaticos } from './automaticos.js';
import { render, toast, actualizarPreview, actualizarPreviewMSI } from './render.js';
import { initNavegacion, mostrarVista, toggleSubmenu } from './navegacion.js';
import { renderReporte } from './reportes.js';
import { cerrarNotificacionExceso } from './presupuesto.js';
import {
  seleccionarTarjeta, seleccionarMonedero,
  nuevaTarjetaAccion, nuevoMonederoAccion,
  agregarGasto, registrarPago, eliminarTxn, cerrarCorte, toggleCorte,
  guardarConfig, eliminarTarjeta,
  agregarMSI, agregarRecurrente,
  agregarGastoMonedero, eliminarMonTxn, cerrarCorteMonedero,
  guardarConfigMonedero, eliminarMonedero,
  accionGuardarPresupuesto,
  exportarJSON, importarJSON, mostrarDiagnostico, resetearDatos
} from './acciones.js';
import {
  abrirModalRec, cerrarModalRec, guardarRecurrente, eliminarRecDesdeModal,
  abrirModalMSI, cerrarModalMSI, guardarMSI, eliminarMSIDesdeModal
} from './modales.js';


//  Utiliza una técnica llamada delegación de eventos, 
// lo que significa que en lugar de poner un "escuchador de clics" en cada botón, 
// pone uno solo en el contenedor principal para gestionar todo de forma más rápida y ordenada.
function initAside() {
  const aside = document.getElementById('aside');
  aside?.addEventListener('click', async e => {
     
    // Toggle Medios de pago
    const togMp = e.target.closest('.aside-section');
    if(togMp){ 
     document.getElementById('submenu-agregar').classList.toggle("hidden");
    }

    // Toggle submenú de tarjeta
    const togTc = e.target.closest('[data-action="toggle-submenu-tc"]');
    if(togTc){ 
      await seleccionarTarjeta(togTc.dataset.id); 
      toggleSubmenu('tc-'+togTc.dataset.id); 
      return; 
    }

    // Toggle submenú de monedero
    const togMon = e.target.closest('[data-action="toggle-submenu-mon"]');
    if(togMon){ await seleccionarMonedero(togMon.dataset.id); toggleSubmenu('mon-'+togMon.dataset.id); return; }

    //Toggle presupuesto
    const togPres = e.target.closest('[data-vista="presupuesto"]');
    if(togPres){ mostrarVista('presupuesto'); return; }
    
    // Seleccionar tarjeta y mostrar vista
    const tcVista = e.target.closest('[data-action="sel-tc-vista"]');
    if(tcVista){ await seleccionarTarjeta(tcVista.dataset.tc); mostrarVista(tcVista.dataset.vista); return; }

    // Seleccionar monedero y mostrar vista
    const monVista = e.target.closest('[data-action="sel-mon-vista"]');
    if(monVista){ await seleccionarMonedero(monVista.dataset.mon); mostrarVista(monVista.dataset.vista); return; }

    // Ir a config de tarjeta
    const cfgTc = e.target.closest('[data-action="config-tc"]');
    if(cfgTc){ await seleccionarTarjeta(cfgTc.dataset.id); mostrarVista('config-tc'); return; }

    // Ir a config de monedero
    const cfgMon = e.target.closest('[data-action="config-mon"]');
    if(cfgMon){ await seleccionarMonedero(cfgMon.dataset.id); mostrarVista('config-mon'); return; }

    // Nueva tarjeta
    if(e.target.closest('[data-action="nueva-tarjeta"]')) { nuevaTarjetaAccion(); return; }

    // Nuevo monedero
    if(e.target.closest('[data-action="nuevo-monedero"]')) { nuevoMonederoAccion(); return; }

    // Items con data-vista directa (sin tarjeta/monedero específico)
    const itemVista = e.target.closest('[data-vista]:not([data-action])');
    if(itemVista) { mostrarVista(itemVista.dataset.vista); return; }
  });
}

// ── Delegación en listas dinámicas ──
function initDelegacion() {
  document.getElementById('txn-list')?.addEventListener('click', e => {
    const btn=e.target.closest('[data-action="eliminar-txn"]');
    if(btn) eliminarTxn(parseInt(btn.dataset.idx));
  });
  document.getElementById('ec-movimientos')?.addEventListener('click', e => {
    const btn=e.target.closest('[data-action="eliminar-txn"]');
    if(btn) eliminarTxn(parseInt(btn.dataset.idx));
  });
  document.getElementById('cortes-list')?.addEventListener('click', e => {
    const h=e.target.closest('[data-action="toggle-corte"]');
    if(h) toggleCorte(parseInt(h.dataset.idx));
  });
  document.getElementById('rec-list')?.addEventListener('click', e => {
    const item=e.target.closest('[data-action="editar-rec"]');
    if(item) abrirModalRec(parseInt(item.dataset.idx));
  });
  document.getElementById('msi-list')?.addEventListener('click', e => {
    const item=e.target.closest('[data-action="editar-msi"]');
    if(item) abrirModalMSI(parseInt(item.dataset.idx));
  });
  document.getElementById('mon-txn-list')?.addEventListener('click', e => {
    const btn=e.target.closest('[data-action="eliminar-mon-txn"]');
    if(btn) eliminarMonTxn(parseInt(btn.dataset.idx));
  });
}

// ── Botones estáticos ──
function initBotones() {
 
  document.getElementById('btn-salir')?.addEventListener('click', ()=>window.close());

  // Gastos tarjeta
  document.getElementById('btn-agregar-gasto')?.addEventListener('click', agregarGasto);
  document.getElementById('inp-concepto')?.addEventListener('keydown', e=>{ if(e.key==='Enter') agregarGasto(); });

  // Pagos
  document.getElementById('btn-registrar-pago')?.addEventListener('click', registrarPago);

  // Corte
  document.getElementById('btn-cerrar-corte')?.addEventListener('click', cerrarCorte);

  // Config tarjeta
  document.getElementById('btn-guardar-config')?.addEventListener('click', guardarConfig);
  document.getElementById('btn-eliminar-tarjeta')?.addEventListener('click', eliminarTarjeta);
  document.getElementById('cfg-dia-corte')?.addEventListener('input', actualizarPreview);
  document.getElementById('cfg-dias-pago')?.addEventListener('change', actualizarPreview);

  // MSI
  document.getElementById('btn-agregar-msi')?.addEventListener('click', agregarMSI);
  document.getElementById('msi-monto')?.addEventListener('input', actualizarPreviewMSI);
  document.getElementById('msi-meses')?.addEventListener('input', actualizarPreviewMSI);
  document.getElementById('msi-fecha-inicio')?.addEventListener('change', actualizarPreviewMSI);

  // Recurrentes
  document.getElementById('btn-agregar-rec')?.addEventListener('click', agregarRecurrente);

  // Monedero
  document.getElementById('btn-agregar-gasto-mon')?.addEventListener('click', agregarGastoMonedero);
  document.getElementById('btn-cerrar-corte-mon')?.addEventListener('click', cerrarCorteMonedero);
  document.getElementById('btn-guardar-config-mon')?.addEventListener('click', guardarConfigMonedero);
  document.getElementById('btn-eliminar-monedero')?.addEventListener('click', eliminarMonedero);

  // Presupuesto
  document.getElementById('btn-guardar-presupuesto')?.addEventListener('click', accionGuardarPresupuesto);
  document.getElementById('pres-total')?.addEventListener('input', ()=>{
    document.querySelectorAll('.pres-cat-input').forEach(inp=>inp.dispatchEvent(new Event('input')));
  });

  // Reporte
  document.getElementById('reporte-periodo')?.addEventListener('change', e=>{
    renderReporte(parseInt(e.target.value));
  });

  // Respaldo
  document.getElementById('btn-exportar')?.addEventListener('click', exportarJSON);
  document.getElementById('btn-importar')?.addEventListener('click', importarJSON);
  document.getElementById('btn-diagnostico')?.addEventListener('click', mostrarDiagnostico);
  document.getElementById('btn-reset')?.addEventListener('click', resetearDatos);

  // Modal exceso presupuesto
  document.getElementById('btn-cerrar-exceso')?.addEventListener('click', cerrarNotificacionExceso);
  document.getElementById('modal-exceso')?.addEventListener('click', e=>{
    if(e.target===document.getElementById('modal-exceso')) cerrarNotificacionExceso();
  });
}

// ── Modales ──
function initModales() {
  document.getElementById('btn-guardar-rec')?.addEventListener('click', guardarRecurrente);
  document.getElementById('btn-eliminar-rec')?.addEventListener('click', eliminarRecDesdeModal);
  document.getElementById('btn-cancelar-rec')?.addEventListener('click', cerrarModalRec);
  document.getElementById('modal-rec')?.addEventListener('click', cerrarModalRec);
  document.getElementById('btn-guardar-msi')?.addEventListener('click', guardarMSI);
  document.getElementById('btn-eliminar-msi')?.addEventListener('click', eliminarMSIDesdeModal);
  document.getElementById('btn-cancelar-msi')?.addEventListener('click', cerrarModalMSI);
  document.getElementById('modal-msi')?.addEventListener('click', cerrarModalMSI);
}

// ── Inicialización ──
async function init() {
  await loadStateFromDB();
  await aplicarAutomaticos();
  initNavegacion();
  initAside();
  initBotones();
  initDelegacion();
  initModales();
  render();
}

init();
