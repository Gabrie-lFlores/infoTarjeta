// ── calculos.js ───────────────────────────────────────────
// Lógica financiera pura: fechas, intereses, pagos mínimos, MSI.
// No accede al DOM ni al estado directamente — recibe parámetros.

// ── Formateo ──
export function fmt(n) {
  return '$' + parseFloat(n || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function fechaHoy() {
  return new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function fmtF(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function fmtFLarga(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

// ── Fechas de corte y pago ──
export function calcFechas(diaCorte, diasPago) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia  = parseInt(diaCorte) || 5;
  const diasP = parseInt(diasPago) || 20;

  // Corte pasado: el último que ya ocurrió
  let cortePasado = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (cortePasado >= hoy)
    cortePasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, dia);

  // Fecha límite de pago
  const pagoLimite = new Date(cortePasado);
  pagoLimite.setDate(pagoLimite.getDate() + diasP);

  // Próximo corte
  let corteProx = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (corteProx <= hoy)
    corteProx = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);

  const msDay         = 86400000;
  const diasParaPago  = Math.ceil((pagoLimite - hoy) / msDay);
  const diasParaCorte = Math.ceil((corteProx  - hoy) / msDay);

  // Inicio del periodo actual = día siguiente al corte pasado
  const inicioPeriodo = new Date(cortePasado);
  inicioPeriodo.setDate(inicioPeriodo.getDate() + 1);

  return { cortePasado, pagoLimite, corteProx, diasParaPago, diasParaCorte, inicioPeriodo };
}

// ── Pago mínimo (regla Banxico MX) ──
// Mayor entre: 5% del saldo o 1.25% del límite de crédito
export function calcPagoMinimo(saldoCorte, limiteCredito) {
  const op1 = saldoCorte * 0.05;
  const op2 = (parseFloat(limiteCredito) || 0) * 0.0125;
  return Math.max(op1, op2, 0);
}

// ── Saldo total de transacciones ──
export function calcSaldoUsado(transacciones, saldoBase) {
  const pagos  = transacciones.filter(t => t.tipo === 'pago').reduce((s, t) => s + t.cantidad, 0);
  const gastos = transacciones.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.cantidad, 0);
  return Math.max(0, saldoBase + gastos - pagos);
}

export function calcTotalCorteActual(transacciones) {
  return transacciones.reduce((s, t) =>
    s + (t.tipo === 'gasto' ? t.cantidad : -t.cantidad), 0);
}

// ── Compras a meses sin intereses ──
export function calcMSI(m) {
  const inicio    = new Date(m.fechaInicio + 'T12:00:00');
  const pagoMes   = m.monto / m.meses;
  const fin       = new Date(inicio);
  fin.setMonth(fin.getMonth() + m.meses);
  fin.setDate(fin.getDate() - 1);
  const hoy       = new Date();
  const mesActual = (hoy.getFullYear() - inicio.getFullYear()) * 12
                  + (hoy.getMonth() - inicio.getMonth()) + 1;
  const mesClamp  = Math.min(Math.max(mesActual, 1), m.meses);
  const vigente   = hoy <= fin;
  return { pagoMes, fin, mesActual: mesClamp, vigente };
}

// ── Cargos de intereses ordinarios y moratorios ──
// Devuelve array de transacciones a agregar (o vacío si no aplica)
export function calcIntereses(config, saldoCorte, pagosRealizados, pagoLimite) {
  const hoy          = new Date(); hoy.setHours(0, 0, 0, 0);
  const cargos       = [];
  const saldoNoPagado = Math.max(0, saldoCorte - pagosRealizados);

  if (saldoNoPagado <= 0) return cargos;

  const diasVencido  = Math.ceil((hoy - pagoLimite) / 86400000);
  const tasaOrd      = parseFloat(config.tasaOrdinaria) || 0;
  const tasaMor      = parseFloat(config.tasaMoratoria) || 0;
  const diasPeriodo  = parseInt(config.diasPago) || 20;
  const fecha        = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  // Intereses ordinarios
  if (tasaOrd > 0) {
    const intOrd = saldoNoPagado * (tasaOrd / 100) * (diasPeriodo / 365);
    const ivaOrd = intOrd * 0.16;
    cargos.push({
      tipo: 'gasto',
      concepto: 'Interés por no cubrir el total',
      cantidad: parseFloat(intOrd.toFixed(2)),
      fecha,
      esInteres: true,
      tipoInteres: 'ordinario'
    });
    cargos.push({
      tipo: 'gasto',
      concepto: 'IVA por intereses ordinarios',
      cantidad: parseFloat(ivaOrd.toFixed(2)),
      fecha,
      esInteres: true,
      tipoInteres: 'iva_ordinario'
    });
  }

  // Intereses moratorios
  if (tasaMor > 0 && diasVencido > 0) {
    const intMor = saldoNoPagado * (tasaMor / 100) * (diasVencido / 365);
    const ivaMor = intMor * 0.16;
    cargos.push({
      tipo: 'gasto',
      concepto: `Interés moratorio (${diasVencido} día${diasVencido > 1 ? 's' : ''} de mora)`,
      cantidad: parseFloat(intMor.toFixed(2)),
      fecha,
      esInteres: true,
      tipoInteres: 'moratorio'
    });
    cargos.push({
      tipo: 'gasto',
      concepto: 'IVA por intereses moratorios',
      cantidad: parseFloat(ivaMor.toFixed(2)),
      fecha,
      esInteres: true,
      tipoInteres: 'iva_moratorio'
    });
  }

  return cargos;
}
