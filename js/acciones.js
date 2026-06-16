// ── acciones.js v10 ───────────────────────────────────────
import { state, tarjetaActiva, monederoActivo, nuevaTarjeta, nuevoMonedero, saveState, resetState, diagnosticoIndexedDB } from './state.js';
import { calcSaldoUsado, calcTotalCorteActual, fechaHoy } from './calculos.js';
import { render, toast } from './render.js';
import { checkRecurrentes, checkMSI } from './automaticos.js';
import { mostrarVista } from './navegacion.js';
import { verificarExceso, mostrarNotificacionExceso, guardarPresupuesto } from './presupuesto.js';

function val(id)  { const e=document.getElementById(id); return e?e.value:''; }
function valF(id) { return parseFloat(val(id)); }
function valI(id) { return parseInt(val(id)); }
function limpiar(id){ const e=document.getElementById(id); if(e) e.value=''; }

export async function seleccionarTarjeta(id) { state.tarjetaActivaId=id; await saveState(); render(); }
export async function seleccionarMonedero(id) { state.monederoActivoId=id; await saveState(); render(); }

export async function nuevaTarjetaAccion() {
  const nombre=prompt('Nombre de la nueva tarjeta:');
  if(!nombre?.trim()) return;
  const tc=nuevaTarjeta(nombre.trim());
  state.tarjetas.push(tc); state.tarjetaActivaId=tc.id;
  await saveState(); render(); mostrarVista('config-tc');
  toast('✅ Tarjeta creada — configura sus datos');
}
export async function nuevoMonederoAccion() {
  const nombre=prompt('Nombre del monedero:');
  if(!nombre?.trim()) return;
  const mon=nuevoMonedero(nombre.trim());
  state.monederos.push(mon); state.monederoActivoId=mon.id;
  await saveState(); render(); mostrarVista('config-mon');
  toast('✅ Monedero creado');
}

export async function agregarGasto() {
  const tc=tarjetaActiva();
  const c=val('inp-concepto').trim();
  const q=valF('inp-cantidad');
  const cat=val('inp-categoria')||'Otro';
  const tipoG=val('inp-tipo-gasto')||'esencial';
  if(!c){toast('Ingresa el concepto del gasto','warn');return;}
  if(isNaN(q)||q<=0){toast('Ingresa una cantidad válida','warn');return;}
  const exceso=verificarExceso(cat,q);
  tc.transacciones.push({tipo:'gasto',concepto:c,cantidad:q,fecha:fechaHoy(),categoria:cat,tipoGasto:tipoG});
  limpiar('inp-concepto'); limpiar('inp-cantidad');
  await saveState(); render(); toast('✅ Gasto registrado');
  mostrarVista('estado-cuenta');
  if(exceso) mostrarNotificacionExceso(exceso);
}

export async function registrarPago() {
  const tc=tarjetaActiva();
  const q=valF('inp-pago');
  if(isNaN(q)||q<=0){toast('Ingresa un monto válido','warn');return;}
  tc.transacciones.push({tipo:'pago',concepto:'Pago realizado',cantidad:q,fecha:fechaHoy()});
  limpiar('inp-pago');
  await saveState(); render(); toast('✅ Pago registrado');
}

export async function eliminarTxn(i) {
  if(!confirm('¿Eliminar este movimiento?')) return;
  tarjetaActiva().transacciones.splice(i,1);
  await saveState(); render(); toast('Movimiento eliminado');
}

export async function cerrarCorte() {
  const tc=tarjetaActiva();
  if(!tc.transacciones.length){toast('Sin movimientos para cerrar','warn');return;}
  if(!confirm('¿Cerrar el corte actual?')) return;
  const total=Math.max(0,calcTotalCorteActual(tc.transacciones));
  tc.saldo=calcSaldoUsado(tc.transacciones,tc.saldo);
  tc.cortes.push({fecha:fechaHoy(),total,transacciones:[...tc.transacciones]});
  tc.transacciones=[];
  await saveState(); render(); toast('✅ Corte cerrado'); mostrarVista('historial');
}

export function toggleCorte(i){ document.getElementById('cb-'+i)?.classList.toggle('open'); }

export async function guardarConfig() {
  const tc=tarjetaActiva();
  tc.nombre=val('cfg-nombre').trim()||'Mi tarjeta';
  tc.limite=valF('cfg-limite')||0; tc.diaCorte=valI('cfg-dia-corte')||0;
  tc.diasPago=valI('cfg-dias-pago')||20; tc.tasaOrdinaria=valF('cfg-tasa-ord')||0;
  tc.tasaMoratoria=valF('cfg-tasa-mor')||0;
  await saveState(); render(); toast('✅ Configuración guardada'); mostrarVista('estado-cuenta');
}

export async function eliminarTarjeta() {
  if(state.tarjetas.length<=1){toast('No puedes eliminar la única tarjeta','warn');return;}
  if(!confirm('¿Eliminar esta tarjeta?')) return;
  state.tarjetas=state.tarjetas.filter(t=>t.id!==state.tarjetaActivaId);
  state.tarjetaActivaId=state.tarjetas[0].id;
  await saveState(); render(); toast('Tarjeta eliminada'); mostrarVista('estado-cuenta');
}

export async function agregarMSI() {
  const tc=tarjetaActiva();
  const concepto=val('msi-concepto').trim(); const monto=valF('msi-monto');
  const meses=valI('msi-meses'); const fechaInicio=val('msi-fecha-inicio');
  if(!concepto){toast('Ingresa el concepto','warn');return;}
  if(isNaN(monto)||monto<=0){toast('Ingresa un monto válido','warn');return;}
  if(!meses||meses<1){toast('Ingresa el número de meses','warn');return;}
  if(!fechaInicio){toast('Selecciona la fecha del primer cargo','warn');return;}
  tc.msi.push({id:Date.now(),concepto,monto,meses,fechaInicio});
  limpiar('msi-concepto');limpiar('msi-monto');limpiar('msi-meses');limpiar('msi-fecha-inicio');
  document.getElementById('msi-preview')?.classList.add('hidden');
  checkMSI(tc); await saveState(); render(); toast('✅ Compra a meses registrada');
}

export async function agregarRecurrente() {
  const tc=tarjetaActiva();
  const concepto=val('rec-concepto').trim(); const cantidad=valF('rec-cantidad');
  const dia=valI('rec-dia'); const periodo=val('rec-periodo')||'mensual';
  if(!concepto){toast('Ingresa el concepto','warn');return;}
  if(isNaN(cantidad)||cantidad<=0){toast('Ingresa una cantidad válida','warn');return;}
  if(!dia||dia<1||dia>28){toast('El día debe ser entre 1 y 28','warn');return;}
  tc.recurrentes.push({id:Date.now(),concepto,cantidad,dia,periodo});
  limpiar('rec-concepto');limpiar('rec-cantidad');limpiar('rec-dia');
  checkRecurrentes(tc); await saveState(); render(); toast('✅ Cargo recurrente agregado');
}

export async function agregarGastoMonedero() {
  const mon=monederoActivo();
  const c=val('mon-concepto').trim(); const q=valF('mon-cantidad');
  const cat=val('mon-categoria')||'Otro'; const tipoG=val('mon-tipo-gasto')||'esencial';
  if(!c){toast('Ingresa el concepto','warn');return;}
  if(isNaN(q)||q<=0){toast('Ingresa una cantidad válida','warn');return;}
  const exceso=verificarExceso(cat,q);
  mon.transacciones.push({tipo:'gasto',concepto:c,cantidad:q,fecha:fechaHoy(),categoria:cat,tipoGasto:tipoG});
  limpiar('mon-concepto');limpiar('mon-cantidad');
  await saveState(); render(); toast('✅ Gasto registrado');
  if(exceso) mostrarNotificacionExceso(exceso);
}

export async function eliminarMonTxn(i) {
  if(!confirm('¿Eliminar este movimiento?')) return;
  monederoActivo().transacciones.splice(i,1);
  await saveState(); render(); toast('Movimiento eliminado');
}

export async function cerrarCorteMonedero() {
  const mon=monederoActivo();
  if(!mon.transacciones.length){toast('Sin movimientos','warn');return;}
  if(!confirm('¿Cerrar el periodo?')) return;
  const total=mon.transacciones.reduce((s,t)=>s+(t.tipo==='gasto'?t.cantidad:0),0);
  mon.cortes.push({fecha:fechaHoy(),total,transacciones:[...mon.transacciones]});
  mon.transacciones=[];
  await saveState(); render(); toast('✅ Periodo cerrado');
}

export async function guardarConfigMonedero() {
  const mon=monederoActivo();
  mon.nombre=val('mon-cfg-nombre').trim()||'Efectivo';
  mon.periodo=val('mon-cfg-periodo')||'quincenal';
  await saveState(); render(); toast('✅ Monedero actualizado'); mostrarVista('gasto-monedero');
}

export async function eliminarMonedero() {
  if(state.monederos.length<=1){toast('No puedes eliminar el único monedero','warn');return;}
  if(!confirm('¿Eliminar este monedero?')) return;
  state.monederos=state.monederos.filter(m=>m.id!==state.monederoActivoId);
  state.monederoActivoId=state.monederos[0].id;
  await saveState(); render(); toast('Monedero eliminado'); mostrarVista('estado-cuenta');
}

export async function accionGuardarPresupuesto() {
  await guardarPresupuesto(); await saveState(); render(); toast('✅ Presupuesto guardado');
}

export function exportarJSON() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`saldo_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
export function importarJSON() {
  const input=document.createElement('input');
  input.type='file'; input.accept='.json';
  input.onchange=async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{
      Object.assign(state,JSON.parse(await file.text()));
      if(!state.tarjetas?.length) state.tarjetas=[nuevaTarjeta()];
      if(!state.monederos?.length) state.monederos=[nuevoMonedero()];
      await saveState(); render(); toast('✅ Datos importados');
    }catch{toast('Archivo inválido','warn');}
  };
  input.click();
}

export async function mostrarDiagnostico() {
  const box=document.getElementById('diag-output');
  if(!box) return;
  box.classList.remove('hidden');
  box.textContent=await diagnosticoIndexedDB();
}
export async function resetearDatos() {
  if(!confirm('¿Eliminar TODOS los datos?')) return;
  await resetState(); render(); toast('Datos eliminados');
}
