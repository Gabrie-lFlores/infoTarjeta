// ── navegacion.js v10 ─────────────────────────────────────
import { renderReporte } from './reportes.js';
import { renderPresupuesto, renderResumenPresupuesto } from './presupuesto.js';

let vistaActual = 'estado-cuenta';

// ── Mostrar vista ──
export function mostrarVista(id) {
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('vista--active'));
  const destino = document.getElementById('vista-' + id);
  if (destino) destino.classList.add('vista--active');
  vistaActual = id;

  // Marcar item activo en aside
  document.querySelectorAll('.aside-item, .aside-subitem').forEach(el => {
    el.classList.toggle('active', el.dataset.vista === id);
  });

  // Acciones especiales al entrar a una vista
  if (id === 'reporte') {
    const sel = document.getElementById('reporte-periodo');
    renderReporte(sel ? parseInt(sel.value) : 1);
  }
  if (id === 'presupuesto') renderPresupuesto();

  cerrarDrawer();
  window.scrollTo(0, 0);
}

// ── Submenú en aside ──
//Cada vez que se abre un submenu del aside, se cierra cualquier otro que este abierto.
export function toggleSubmenu(id) {
  const sub = document.getElementById('submenu-' + id);
  if (!sub) return;
  const arrow = document.querySelector(`[data-toggle="${id}"] .aside-arrow`);
  const isOpen = !sub.classList.contains('hidden');
  // Cerrar todos los submenús
  document.querySelectorAll('.aside-submenu').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.aside-arrow').forEach(el => el.textContent = '›');
  if (!isOpen) {
    sub.classList.remove('hidden');
    if (arrow) arrow.textContent = '⌄';
  }
}

// ── Render dinámico del aside (tarjetas y monederos) ──
export function renderAside(tarjetas, tarjetaActivaId, monederos, monederoActivoId) {
  renderAsideTarjetas(tarjetas, tarjetaActivaId);
  renderAsideMonederos(monederos, monederoActivoId);
  renderResumenPresupuesto();
}

function renderAsideTarjetas(tarjetas, activaId) {
  const zona = document.getElementById('aside-tarjetas-zona');
  if (!zona) return;
  zona.innerHTML = tarjetas.map(tc => `
    <div class="aside-tc-group">
      <button class="aside-menu-btn ${tc.id === activaId ? 'aside-menu-btn--active' : ''}"
              data-toggle="tc-${tc.id}" data-action="toggle-submenu-tc" data-id="${tc.id}">
        <span class="aside-menu-icon">💳</span>
        <span class="aside-menu-label">${tc.nombre}</span>
        <span class="aside-arrow">›</span>
      </button>
      <div class="aside-submenu hidden" id="submenu-tc-${tc.id}">
        <button class="aside-subitem" data-vista="estado-cuenta"   data-tc="${tc.id}" data-action="sel-tc-vista">📋 Estado de cuenta</button>
        <button class="aside-subitem" data-vista="gasto-tarjeta"   data-tc="${tc.id}" data-action="sel-tc-vista">➕ Registrar gasto</button>
        <button class="aside-subitem" data-vista="pago-tarjeta"    data-tc="${tc.id}" data-action="sel-tc-vista">💳 Registrar pago</button>
        <button class="aside-subitem" data-vista="domiciliados"    data-tc="${tc.id}" data-action="sel-tc-vista">🔄 Domiciliados</button>
        <button class="aside-subitem" data-vista="msi"             data-tc="${tc.id}" data-action="sel-tc-vista">📅 Meses sin intereses</button>
        <button class="aside-subitem" data-vista="estadisticos-tc" data-tc="${tc.id}" data-action="sel-tc-vista">📊 Estadísticos</button>
        <button class="aside-subitem aside-subitem--danger"        data-action="config-tc" data-id="${tc.id}">⚙️ Configurar tarjeta</button>
      </div>
    </div>`).join('');
}

function renderAsideMonederos(monederos, activaId) {
  const zona = document.getElementById('aside-monederos-zona');
  if (!zona) return;
  zona.innerHTML = monederos.map(mon => `
    <div class="aside-mon-group">
      <button class="aside-menu-btn ${mon.id === activaId ? 'aside-menu-btn--active' : ''}"
              data-toggle="mon-${mon.id}" data-action="toggle-submenu-mon" data-id="${mon.id}">
        <span class="aside-menu-icon">👛</span>
        <span class="aside-menu-label">${mon.nombre}</span>
        <span class="aside-arrow">›</span>
      </button>
      <div class="aside-submenu hidden" id="submenu-mon-${mon.id}">
        <button class="aside-subitem" data-vista="gasto-monedero"    data-mon="${mon.id}" data-action="sel-mon-vista">➕ Registrar gasto</button>
        <button class="aside-subitem" data-vista="estadisticos-mon"  data-mon="${mon.id}" data-action="sel-mon-vista">📊 Estadísticos</button>
        <button class="aside-subitem aside-subitem--danger"          data-action="config-mon" data-id="${mon.id}">⚙️ Configurar monedero</button>
      </div>
    </div>`).join('');
}

// ── Drawer móvil ──
export function abrirDrawer() {
  document.getElementById('aside')?.classList.add('aside--open');
  document.getElementById('aside-overlay')?.classList.remove('hidden');
}
export function cerrarDrawer() {
  document.getElementById('aside')?.classList.remove('aside--open');
  document.getElementById('aside-overlay')?.classList.add('hidden');
}

export function initNavegacion() {
  document.getElementById('btn-menu')?.addEventListener('click', () => {
    document.getElementById('aside')?.classList.contains('aside--open')
      ? cerrarDrawer() : abrirDrawer();
  });
  document.getElementById('aside-overlay')?.addEventListener('click', cerrarDrawer);
  navegarA('estado-cuenta');
}

// Alias para compatibilidad con acciones.js
export function navegarA(id) { mostrarVista(id); }
