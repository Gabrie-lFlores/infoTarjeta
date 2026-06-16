// ── reportes.js v9 ────────────────────────────────────────
// Gráficas de pastel (categoría y tipo) con leyenda visible

import { state, CATEGORIAS_GASTO, CATEGORIAS_TIPO } from './state.js';
import { fmt } from './calculos.js';

// ── Paleta de colores ──
const COLORES_CAT = [
  '#2980b9','#27ae60','#e67e22','#c0392b','#8e44ad',
  '#16a085','#d35400','#f39c12','#1abc9c','#e74c3c',
  '#9b59b6','#3498db','#2ecc71','#95a5a6'
];

const COLORES_TIPO = {
  esencial:     '#27ae60',
  valioso:      '#2980b9',
  conveniencia: '#e67e22',
  impulso:      '#c0392b',
  estatus:      '#8e44ad'
};

// ── Parsear fecha local ──
function parseFecha(str) {
  if (!str) return new Date(0);
  const meses = { ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11 };
  const p = str.toLowerCase().replace(/\./g,'').split(' ');
  if (p.length === 3) return new Date(parseInt(p[2]), meses[p[1]] ?? 0, parseInt(p[0]));
  return new Date(str);
}

// ── Recolectar gastos del periodo ──
function recolectarGastos(meses = 1) {
  const hoy   = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1);
  const gastos = [];

  state.tarjetas.forEach(tc => {
    tc.transacciones
      .filter(t => t.tipo==='gasto' && !t.esInteres && parseFecha(t.fecha) >= desde)
      .forEach(t => gastos.push({ ...t, medio: tc.nombre }));
    tc.cortes.forEach(c =>
      (c.transacciones||[])
        .filter(t => t.tipo==='gasto' && !t.esInteres && parseFecha(t.fecha) >= desde)
        .forEach(t => gastos.push({ ...t, medio: tc.nombre }))
    );
  });

  state.monederos.forEach(mon => {
    mon.transacciones
      .filter(t => t.tipo==='gasto' && parseFecha(t.fecha) >= desde)
      .forEach(t => gastos.push({ ...t, medio: mon.nombre }));
    mon.cortes.forEach(c =>
      (c.transacciones||[])
        .filter(t => t.tipo==='gasto' && parseFecha(t.fecha) >= desde)
        .forEach(t => gastos.push({ ...t, medio: mon.nombre }))
    );
  });

  return gastos;
}

// ── Gráfica de pastel genérica ──
function dibujarPastel(canvasId, entradas, colores) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Ajustar tamaño al contenedor
  canvas.width  = canvas.parentElement?.offsetWidth || 340;
  canvas.height = canvas.width;   // cuadrado para que el pastel quepa bien

  const ctx   = canvas.getContext('2d');
  const W     = canvas.width;
  const H     = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = entradas.reduce((s,[,v]) => s+v, 0);
  if (total === 0) { dibujarVacio(ctx, W, H, 'Sin datos en el periodo'); return; }

  // Zona del pastel: 58% de la altura
  const radioZona = H * 0.58;
  const cx        = W / 2;
  const cy        = radioZona * 0.5 + 10;
  const radio     = radioZona * 0.44;
  let angulo      = -Math.PI / 2;

  // Dibujar sectores
  entradas.forEach(([, val], i) => {
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radio, angulo, angulo + slice);
    ctx.closePath();
    ctx.fillStyle   = colores[i % colores.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.stroke();
    angulo += slice;
  });

  // Total central
  ctx.textAlign = 'center';
  ctx.font      = `bold ${Math.round(W*0.04)}px system-ui`;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(fmt(total), cx, cy - 4);
  ctx.font      = `${Math.round(W*0.032)}px system-ui`;
  ctx.fillStyle = '#888';
  ctx.fillText('total', cx, cy + Math.round(W*0.04));

  // Leyenda en la parte inferior
  const leyY     = cy + radio + 18;
  const colW     = W / 2;
  const lineH    = Math.max(22, Math.round(H * 0.065));
  const fSize    = Math.max(13, Math.round(W * 0.038));
  ctx.font       = `600 ${fSize}px system-ui`;
  ctx.textAlign  = 'left';

  entradas.forEach(([label, v], i) => {
    const col  = i % 2;
    const fila = Math.floor(i / 2);
    const x    = col * colW + 10;
    const y    = leyY + fila * lineH;
    if (y + lineH > H) return;

    // Cuadro de color
    const boxSize = fSize - 2;
    ctx.fillStyle = colores[i % colores.length];
    ctx.beginPath();
    ctx.roundRect(x, y - boxSize + 2, boxSize, boxSize, 3);
    ctx.fill();

    // Texto etiqueta
    ctx.fillStyle = '#222';
    const pct     = ((v / total) * 100).toFixed(1);
    const texto   = `${label} ${pct}%`;
    ctx.fillText(texto, x + boxSize + 6, y);
  });

  ctx.textAlign = 'left';
}

// ── Pastel por CATEGORÍA (¿en qué gasté?) ──
export function dibujarPastelCat(canvasId, gastos) {
  const totales = {};
  gastos.forEach(g => {
    const cat = g.categoria || 'Otro';
    totales[cat] = (totales[cat] || 0) + g.cantidad;
  });
  const entradas = Object.entries(totales).sort((a,b) => b[1]-a[1]);
  dibujarPastel(canvasId, entradas, COLORES_CAT);
}

// ── Pastel por TIPO (esencial, impulso, etc.) ──
export function dibujarPastelTipo(canvasId, gastos) {
  const totales = {};
  CATEGORIAS_TIPO.forEach(ct => { totales[ct.valor] = 0; });
  gastos.forEach(g => {
    const tipo = g.tipoGasto || 'esencial';
    if (tipo in totales) totales[tipo] += g.cantidad;
  });
  const entradas = CATEGORIAS_TIPO
    .map(ct => [ct.label, totales[ct.valor]])
    .filter(([,v]) => v > 0);
  const colores  = CATEGORIAS_TIPO
    .filter(ct => totales[ct.valor] > 0)
    .map(ct => COLORES_TIPO[ct.valor]);
  dibujarPastel(canvasId, entradas, colores);
}

function dibujarVacio(ctx, W, H, msg) {
  ctx.fillStyle  = '#bbb';
  ctx.font       = '14px system-ui';
  ctx.textAlign  = 'center';
  ctx.fillText(msg, W/2, H/2);
  ctx.textAlign  = 'left';
}

// ── Renderizar pantalla de reporte ──
export function renderReporte(meses = 1) {
  const gastos = recolectarGastos(meses);
  const total  = gastos.reduce((s,g) => s+g.cantidad, 0);

  // Totales por medio
  const porMedio = {};
  gastos.forEach(g => { porMedio[g.medio] = (porMedio[g.medio]||0) + g.cantidad; });

  const resumen = document.getElementById('reporte-resumen');
  if (resumen) {
    resumen.innerHTML =
      `<div class="reporte-total">Total: <strong>${fmt(total)}</strong></div>` +
      Object.entries(porMedio).map(([m,v]) =>
        `<div class="reporte-medio"><span>${m}</span><strong>${fmt(v)}</strong></div>`
      ).join('');
  }

  // Forzar que los canvas sean cuadrados antes de dibujar
  ['canvas-pastel','canvas-pastel-tipo'].forEach(id => {
    const c = document.getElementById(id);
    if (c) {
      c.width  = c.parentElement?.offsetWidth || 340;
      c.height = c.width;
    }
  });

  dibujarPastelCat('canvas-pastel', gastos);
  dibujarPastelTipo('canvas-pastel-tipo', gastos);
}
