// ── automaticos.js ────────────────────────────────────────
// Aplica cargos automáticos: recurrentes, MSI e intereses.
// Modifica state.transacciones e state.interesesAplicados.

import { state, saveState } from './state.js';
import { calcFechas, calcMSI, calcIntereses, fechaHoy } from './calculos.js';

// ── Cargos recurrentes / domiciliación ──
export function checkRecurrentes() {
  if (!state.recurrentes?.length) return;
  const hoy     = new Date();
  const dHoy    = hoy.getDate();
  const mesAnio = hoy.getFullYear() * 100 + hoy.getMonth();

  state.recurrentes.forEach(r => {
    const key = `rec_${r.id}_${mesAnio}`;
    if (state.transacciones.some(t => t.recKey === key)) return;

    let debe = false;
    if (r.periodo === 'mensual'    && dHoy >= parseInt(r.dia)) debe = true;
    if (r.periodo === 'bimestral'  && dHoy >= parseInt(r.dia) && hoy.getMonth() % 2 === 0) debe = true;
    if (r.periodo === 'trimestral' && dHoy >= parseInt(r.dia) && hoy.getMonth() % 3 === 0) debe = true;
    if (r.periodo === 'anual'      && dHoy >= parseInt(r.dia) && hoy.getMonth() === 0) debe = true;

    if (debe) {
      state.transacciones.push({
        tipo: 'gasto',
        concepto: r.concepto,
        cantidad: parseFloat(r.cantidad),
        fecha: fechaHoy(),
        recKey: key,
        esRec: true
      });
    }
  });
}

// ── Cuotas de meses sin intereses ──
export function checkMSI() {
  if (!state.msi?.length) return;
  const hoy     = new Date();
  const mesAnio = hoy.getFullYear() * 100 + hoy.getMonth();
  const diaCorte = parseInt(state.config.diaCorte) || 5;

  state.msi.forEach(m => {
    const { pagoMes, mesActual, vigente } = calcMSI(m);
    if (!vigente) return;

    const key = `msi_${m.id}_${mesAnio}`;
    if (state.transacciones.some(t => t.recKey === key)) return;

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

  // Limpiar MSI vencidas
  state.msi = state.msi.filter(m => calcMSI(m).vigente);
}

// ── Intereses automáticos tras vencimiento ──
export function checkIntereses() {
  if (!state.config.diaCorte) return;

  const { cortePasado, pagoLimite } = calcFechas(
    state.config.diaCorte,
    state.config.diasPago
  );
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  // Solo aplica si ya venció la fecha límite
  if (hoy <= pagoLimite) return;

  // Clave única por periodo para no duplicar
  const periodoKey = `int_${cortePasado.getFullYear()}_${cortePasado.getMonth()}_${cortePasado.getDate()}`;
  if (state.interesesAplicados.includes(periodoKey)) return;

  const saldoCorte = state.cortes.length
    ? state.cortes[state.cortes.length - 1].total
    : 0;

  if (saldoCorte <= 0) {
    state.interesesAplicados.push(periodoKey);
    return;
  }

  const pagosRealizados = state.transacciones
    .filter(t => t.tipo === 'pago')
    .reduce((s, t) => s + t.cantidad, 0);

  const cargos = calcIntereses(
    state.config,
    saldoCorte,
    pagosRealizados,
    pagoLimite
  );

  cargos.forEach(c => state.transacciones.push(c));
  state.interesesAplicados.push(periodoKey);
}

// ── Ejecutar todos los automáticos ──
export async function aplicarAutomaticos() {
  checkRecurrentes();
  checkMSI();
  checkIntereses();
  await saveState();
}
