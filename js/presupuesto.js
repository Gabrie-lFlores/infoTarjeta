// ── presupuesto.js v10 ────────────────────────────────────
// Maneja el presupuesto mensual y las notificaciones de exceso.

import { state, saveState, CATEGORIAS_GASTO, GRUPOS_PRESUPUESTO } from './state.js';
import { fmt } from './calculos.js';

// ── Calcular gastos del mes actual por categoría ──
export function gastosMesActual() {
  const hoy   = new Date();
  const anio  = hoy.getFullYear();
  const mes   = hoy.getMonth();
  const totales = {};
  CATEGORIAS_GASTO.forEach(c => { totales[c] = 0; });

  function sumar(txns) {
    txns.filter(t => t.tipo === 'gasto' && !t.esInteres).forEach(t => {
      const f = parseFecha(t.fecha);
      if (f.getFullYear() === anio && f.getMonth() === mes) {
        const cat = t.categoria || 'Otro';
        if (cat in totales) totales[cat] += t.cantidad;
      }
    });
  }

  state.tarjetas.forEach(tc => {
    sumar(tc.transacciones);
    tc.cortes.forEach(c => sumar(c.transacciones || []));
  });
  state.monederos.forEach(mon => {
    sumar(mon.transacciones);
    mon.cortes.forEach(c => sumar(c.transacciones || []));
  });

  return totales;
}

function parseFecha(str) {
  if (!str) return new Date(0);
  const meses = { ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11 };
  const p = str.toLowerCase().replace(/\./g,'').split(' ');
  if (p.length === 3) return new Date(parseInt(p[2]), meses[p[1]] ?? 0, parseInt(p[0]));
  return new Date(str);
}

// ── Verificar si un nuevo gasto excede el presupuesto ──
export function verificarExceso(categoria, cantidadNueva) {
  const pres   = state.presupuesto;
  const limite = pres.categorias?.[categoria] || 0;
  if (limite <= 0) return null; // sin límite definido para esa categoría

  const actuales = gastosMesActual();
  const gastoActual = actuales[categoria] || 0;
  const nuevoTotal  = gastoActual + cantidadNueva;

  if (nuevoTotal > limite) {
    return {
      categoria,
      limite,
      gastoActual,
      cantidadNueva,
      nuevoTotal,
      exceso: nuevoTotal - limite
    };
  }
  return null;
}

// ── Mostrar modal de notificación de exceso ──
export function mostrarNotificacionExceso(exceso) {
  const modal = document.getElementById('modal-exceso');
  if (!modal) return;

  document.getElementById('exceso-categoria').textContent  = exceso.categoria;
  document.getElementById('exceso-limite').textContent     = fmt(exceso.limite);
  document.getElementById('exceso-actual').textContent     = fmt(exceso.gastoActual);
  document.getElementById('exceso-nuevo').textContent      = fmt(exceso.cantidadNueva);
  document.getElementById('exceso-total').textContent      = fmt(exceso.nuevoTotal);
  document.getElementById('exceso-cantidad').textContent   = fmt(exceso.exceso);

  modal.classList.remove('hidden');
}

export function cerrarNotificacionExceso() {
  document.getElementById('modal-exceso')?.classList.add('hidden');
}

// ── Guardar presupuesto ──
export async function guardarPresupuesto() {
  const total = parseFloat(document.getElementById('pres-total')?.value) || 0;
  state.presupuesto.total = total;

  CATEGORIAS_GASTO.forEach(cat => {
    const id  = 'pres-cat-' + cat.replace(/\s+/g,'-').toLowerCase();
    const val = parseFloat(document.getElementById(id)?.value) || 0;
    state.presupuesto.categorias[cat] = val;
  });

  await saveState();
  return true;
}

// ── Renderizar formulario de presupuesto ──
export function renderPresupuesto() {
  const pres    = state.presupuesto;
  const gastos  = gastosMesActual();
  const totalEl = document.getElementById('pres-total');
  if (totalEl) totalEl.value = pres.total || '';

  // Calcular suma de categorías para mostrar porcentaje
  const sumaDefinida = Object.values(pres.categorias).reduce((s,v) => s+v, 0);

  Object.entries(GRUPOS_PRESUPUESTO).forEach(([grupo, cats]) => {
    const grupoEl = document.getElementById('pres-grupo-' + grupo.replace(/\s+/g,'-').toLowerCase());
    if (!grupoEl) return;
    grupoEl.innerHTML = '';

    cats.forEach(cat => {
      const id      = 'pres-cat-' + cat.replace(/\s+/g,'-').toLowerCase();
      const limite  = pres.categorias[cat] || 0;
      const gastado = gastos[cat] || 0;
      const pct     = pres.total > 0 ? ((limite / pres.total) * 100).toFixed(1) : '—';
      const excedido = gastado > limite && limite > 0;

      grupoEl.innerHTML += `
        <div class="pres-cat-row ${excedido ? 'pres-cat-row--excedido' : ''}">
          <label class="pres-cat-label" for="${id}">${cat}</label>
          <div class="pres-cat-inputs">
            <input type="number" id="${id}" class="pres-cat-input"
                   placeholder="0.00" min="0" step="10"
                   value="${limite || ''}">
            <span class="pres-cat-pct">${pct}%</span>
            <span class="pres-cat-gastado ${excedido ? 'text-danger' : ''}">
              ${fmt(gastado)} gastado
            </span>
          </div>
        </div>`;
    });
  });

  // Actualizar porcentajes en tiempo real al escribir
  document.querySelectorAll('.pres-cat-input').forEach(input => {
    input.addEventListener('input', actualizarPorcentajes);
  });
}

function actualizarPorcentajes() {
  const total = parseFloat(document.getElementById('pres-total')?.value) || 0;
  document.querySelectorAll('.pres-cat-input').forEach(input => {
    const val  = parseFloat(input.value) || 0;
    const pct  = total > 0 ? ((val / total) * 100).toFixed(1) : '—';
    const pctEl = input.parentElement?.querySelector('.pres-cat-pct');
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

// ── Render barra de progreso presupuesto (para aside/dashboard) ──
export function renderResumenPresupuesto() {
  const el = document.getElementById('aside-presupuesto-resumen');
  if (!el) return;

  const pres   = state.presupuesto;
  if (!pres.total) { el.innerHTML = ''; return; }

  const gastos = gastosMesActual();
  const totalGastado = Object.values(gastos).reduce((s,v) => s+v, 0);
  const pct    = Math.min(100, (totalGastado / pres.total) * 100);
  const excedido = totalGastado > pres.total;

  el.innerHTML = `
    <div class="aside-pres-label">Presupuesto mensual</div>
    <div class="aside-pres-bar-bg">
      <div class="aside-pres-bar-fill ${excedido ? 'aside-pres-bar--danger' : pct > 80 ? 'aside-pres-bar--warn' : ''}"
           style="width:${pct}%"></div>
    </div>
    <div class="aside-pres-nums">
      <span class="${excedido ? 'text-danger-light' : 'text-muted-light'}">${fmt(totalGastado)}</span>
      <span class="text-muted-light">/ ${fmt(pres.total)}</span>
    </div>`;
}
