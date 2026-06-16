// ── automaticos.js v8 ─────────────────────────────────────
// Opera sobre la tarjeta activa del estado.

import { state, tarjetaActiva, saveState } from './state.js';
import { calcFechas, calcMSI, calcIntereses, fechaHoy } from './calculos.js';

export function checkRecurrentes(tc) {
  if (!tc.recurrentes?.length) return;
  const hoy     = new Date();
  const dHoy    = hoy.getDate();
  const mesAnio = hoy.getFullYear() * 100 + hoy.getMonth();

  tc.recurrentes.forEach(r => {
    const key = `rec_${r.id}_${mesAnio}`;
    if (tc.transacciones.some(t => t.recKey === key)) return;
    let debe = false;
    if (r.periodo === 'mensual'    && dHoy >= parseInt(r.dia)) debe = true;
    if (r.periodo === 'bimestral'  && dHoy >= parseInt(r.dia) && hoy.getMonth() % 2 === 0) debe = true;
    if (r.periodo === 'trimestral' && dHoy >= parseInt(r.dia) && hoy.getMonth() % 3 === 0) debe = true;
    if (r.periodo === 'anual'      && dHoy >= parseInt(r.dia) && hoy.getMonth() === 0) debe = true;
    if (debe) {
      tc.transacciones.push({
        tipo: 'gasto', concepto: r.concepto,
        cantidad: parseFloat(r.cantidad),
        fecha: fechaHoy(), recKey: key, esRec: true,
        categoria: r.categoria || 'Servicios',
        tipoGasto: r.tipoGasto || 'esencial'
      });
    }
  });
}

export function checkMSI(tc) {
  if (!tc.msi?.length) return;
  const hoy      = new Date(); hoy.setHours(0, 0, 0, 0);
  const mesAnio  = hoy.getFullYear() * 100 + hoy.getMonth();
  const diaCorte = parseInt(tc.diaCorte) || 5;

  tc.msi.forEach(m => {
    const inicio = new Date(m.fechaInicio + 'T00:00:00');
    inicio.setHours(0, 0, 0, 0);
    if (hoy < inicio) return;

    const { pagoMes, mesActual, vigente } = calcMSI(m);
    if (!vigente) return;

    const key = `msi_${m.id}_${mesAnio}`;
    if (tc.transacciones.some(t => t.recKey === key)) return;

    const esElMesDeInicio =
      hoy.getFullYear() === inicio.getFullYear() &&
      hoy.getMonth()    === inicio.getMonth();

    if (esElMesDeInicio && hoy.getDate() < diaCorte) return;
    if (!esElMesDeInicio && hoy.getDate() < diaCorte) return;

    tc.transacciones.push({
      tipo: 'gasto',
      concepto: `${m.concepto} — MSI ${mesActual} de ${m.meses}`,
      cantidad: parseFloat(pagoMes.toFixed(2)),
      fecha: fechaHoy(), recKey: key, esMSI: true,
      categoria: 'Otro', tipoGasto: 'esencial'
    });
  });

  tc.msi = tc.msi.filter(m => calcMSI(m).vigente);
}

export function checkIntereses(tc) {
  if (!tc.diaCorte) return;
  const { cortePasado, pagoLimite } = calcFechas(tc.diaCorte, tc.diasPago);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (hoy <= pagoLimite) return;

  const periodoKey = `int_${cortePasado.getFullYear()}_${cortePasado.getMonth()}_${cortePasado.getDate()}`;
  if (tc.interesesAplicados.includes(periodoKey)) return;

  const saldoCorte = tc.cortes.length ? tc.cortes[tc.cortes.length - 1].total : 0;
  if (saldoCorte <= 0) { tc.interesesAplicados.push(periodoKey); return; }

  const pagosRealizados = tc.transacciones
    .filter(t => t.tipo === 'pago')
    .reduce((s, t) => s + t.cantidad, 0);

  const cargos = calcIntereses(tc, saldoCorte, pagosRealizados, pagoLimite);
  cargos.forEach(c => tc.transacciones.push({ ...c, categoria: 'Servicios', tipoGasto: 'esencial' }));
  tc.interesesAplicados.push(periodoKey);
}

export async function aplicarAutomaticos() {
  state.tarjetas.forEach(tc => {
    checkRecurrentes(tc);
    checkMSI(tc);
    checkIntereses(tc);
  });
  await saveState();
}
