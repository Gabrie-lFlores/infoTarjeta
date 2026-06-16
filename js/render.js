import { dibujarPastelCat, dibujarPastelTipo } from './reportes.js';
// ── render.js v10 ─────────────────────────────────────────
import { state, tarjetaActiva, monederoActivo, CATEGORIAS_GASTO } from './state.js';
import {
  fmt, fmtF, fmtFLarga,
  calcFechas, calcPagoMinimo,
  calcSaldoUsado, calcTotalCorteActual, calcMSI
} from './calculos.js';
import { renderAside } from './navegacion.js';
import { renderResumenPresupuesto } from './presupuesto.js';

export function render() {
  const tc  = tarjetaActiva();
  const mon = monederoActivo();
  renderAside(state.tarjetas, state.tarjetaActivaId, state.monederos, state.monederoActivoId);
  renderEstadoCuenta(tc);
  renderCorteActual(tc);
  renderHistorial(tc);
  renderMSI(tc);
  renderRecurrentes(tc);
  renderMonedero(mon);
  renderEstadisticosTc(tc);
  renderEstadisticosMon(mon);
  renderEstadisticosGlobales();
  renderConfigTc(tc);
  renderConfigMon(mon);
  renderResumenPresupuesto();
}

// ── Estado de cuenta (vista principal) ──
function renderEstadoCuenta(tc) {
  setTxt('ec-nombre', tc.nombre);
  const usado  = calcSaldoUsado(tc.transacciones, tc.saldo);
  const limite = parseFloat(tc.limite) || 0;
  setTxt('ec-usado',  fmt(usado));
  setTxt('ec-disp',   limite ? fmt(Math.max(0, limite - usado)) : '—');
  setTxt('ec-limite', limite ? fmt(limite) : 'Sin configurar');

  // Barra
  const section = document.getElementById('ec-bar-section');
  if (limite > 0 && section) {
    const pct = Math.min(100, (usado / limite) * 100);
    const bar = document.getElementById('ec-bar');
    if (bar) { bar.style.width = pct + '%'; bar.className = 'bar-fill' + (pct>90?' danger':pct>70?' warn':''); }
    setTxt('ec-pct', pct.toFixed(1) + '% del límite utilizado');
    section.classList.remove('hidden');
  } else if (section) section.classList.add('hidden');

  if (!tc.diaCorte) {
    setTxt('ec-alert', '⚙️ Configura tu tarjeta para ver el estado de cuenta');
    ['ec-corte-anterior','ec-corte-actual'].forEach(id => {
      const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    return;
  }

  setTxt('ec-alert', '');
  const { cortePasado, pagoLimite, corteProx, diasParaPago, diasParaCorte, inicioPeriodo }
    = calcFechas(tc.diaCorte, tc.diasPago);

  const saldoAnt  = tc.cortes.length ? tc.cortes[tc.cortes.length-1].total : 0;
  const pagoMin   = calcPagoMinimo(saldoAnt, limite);
  const cuotaMSI  = (tc.msi||[]).filter(m=>calcMSI(m).vigente).reduce((s,m)=>s+calcMSI(m).pagoMes,0);
  const totalAct  = Math.max(0, calcTotalCorteActual(tc.transacciones));

  // Periodo anterior (estado de cuenta)
  const elAnt = document.getElementById('ec-corte-anterior');
  if (elAnt) {
    elAnt.classList.remove('hidden');
    setTxt('ec-ant-fecha',    fmtF(cortePasado));
    setTxt('ec-ant-limite',   fmtF(pagoLimite));
    setTxt('ec-ant-total',    fmt(saldoAnt));
    setTxt('ec-ant-min',      fmt(pagoMin));
    setTxt('ec-ant-sin-int',  fmt(saldoAnt));
    setTxt('ec-ant-msi',      fmt(cuotaMSI));
    setTxt('ec-ant-min-msi',  fmt(pagoMin + cuotaMSI));

    const diasEl = document.getElementById('ec-ant-dias');
    if (diasEl) {
      if (diasParaPago > 5)       { diasEl.textContent=`✅ ${diasParaPago} días para pagar`; diasEl.className='ec-dias-badge ec-dias--ok'; }
      else if (diasParaPago > 0)  { diasEl.textContent=`⚠️ ¡${diasParaPago} días!`; diasEl.className='ec-dias-badge ec-dias--warn'; }
      else if (diasParaPago === 0){ diasEl.textContent='🚨 ¡Vence hoy!'; diasEl.className='ec-dias-badge ec-dias--danger'; }
      else                        { diasEl.textContent=`❌ Vencido ${Math.abs(diasParaPago)} días`; diasEl.className='ec-dias-badge ec-dias--danger'; }
    }
  }

  // Periodo actual
  const elAct = document.getElementById('ec-corte-actual');
  if (elAct) {
    elAct.classList.remove('hidden');
    setTxt('ec-act-inicio',  fmtF(inicioPeriodo));
    setTxt('ec-act-corte',   fmtF(corteProx));
    setTxt('ec-act-dias',    diasParaCorte + ' días');
    setTxt('ec-act-total',   fmt(totalAct));
    const msiActivos = (tc.msi||[]).filter(m=>calcMSI(m).vigente);
    setTxt('ec-act-msi',     msiActivos.length ? msiActivos.length+' activa(s)' : '—');
  }

  // Alertas
  const alerts = document.getElementById('ec-alerts');
  if (alerts) {
    alerts.innerHTML = '';
    if (diasParaPago===2)   alerts.innerHTML+=`<div class="alert alert-warn">⚠️ Fecha límite en 2 días — ${fmtFLarga(pagoLimite)}</div>`;
    else if(diasParaPago===1) alerts.innerHTML+=`<div class="alert alert-danger">🔔 ¡Mañana vence tu pago!</div>`;
    else if(diasParaPago===0) alerts.innerHTML+=`<div class="alert alert-danger">🚨 ¡Hoy vence el pago!</div>`;
    else if(diasParaPago<0)   alerts.innerHTML+=`<div class="alert alert-danger">❌ Pago vencido hace ${Math.abs(diasParaPago)} días</div>`;
    const hoy=new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    const ints=tc.transacciones.filter(t=>t.esInteres&&t.fecha===hoy);
    if(ints.length) alerts.innerHTML+=`<div class="alert alert-danger">💸 ${ints.length} cargo(s) de intereses aplicados hoy</div>`;
  }

  // Movimientos del periodo actual en estado de cuenta
  renderMovimientosEC(tc);
}

function renderMovimientosEC(tc) {
  const el = document.getElementById('ec-movimientos');
  if (!el) return;
  if (!tc.transacciones.length) { el.innerHTML='<div class="empty">Sin movimientos en el periodo actual</div>'; return; }
  el.innerHTML = [...tc.transacciones].reverse().map((t,ri) => {
    const i      = tc.transacciones.length-1-ri;
    const isPago = t.tipo==='pago';
    return `<div class="mov-row ${isPago?'mov-row--pago':''}">
      <div class="mov-icon">${txnIcon(t)}</div>
      <div class="mov-info">
        <span class="mov-concepto">${t.concepto}</span>
        <span class="mov-meta">${t.fecha}${t.categoria?' · '+t.categoria:''}</span>
      </div>
      <span class="mov-monto ${isPago?'color-success':'color-danger'}">${isPago?'-':'+'}${fmt(t.cantidad)}</span>
    </div>`;
  }).join('');
}

// ── Corte actual ──
function renderCorteActual(tc) {
  const list = document.getElementById('txn-list');
  if (!list) return;
  if (!tc.transacciones.length) {
    list.innerHTML='<div class="empty">Sin movimientos en este corte</div>';
    document.getElementById('corte-subtotal')?.classList.add('hidden');
    setTxt('txn-count','0'); return;
  }
  list.innerHTML=[...tc.transacciones].reverse().map((t,ri)=>{
    const i=tc.transacciones.length-1-ri;
    const isPago=t.tipo==='pago';
    return `<div class="txn-item">
      <div class="txn-icon ${txnIconClass(t)}">${txnIcon(t)}</div>
      <div class="txn-body">
        <div class="txn-header-row"><span class="txn-concept">${t.concepto}</span></div>
        <div class="txn-badges">${txnBadge(t)}${t.categoria?`<span class="badge badge-cat">${t.categoria}</span>`:''}</div>
        <div class="txn-date">${t.fecha}</div>
      </div>
      <span class="${txnAmountClass(t)}">${isPago?'-':'+'}${fmt(t.cantidad)}</span>
      <button class="del-btn" data-action="eliminar-txn" data-idx="${i}" aria-label="Eliminar">✕</button>
    </div>`;
  }).join('');
  const total=calcTotalCorteActual(tc.transacciones);
  setTxt('corte-total-val',fmt(Math.max(0,total)));
  const sub=document.getElementById('corte-subtotal');
  if(sub) total>0?sub.classList.remove('hidden'):sub.classList.add('hidden');
  setTxt('txn-count',tc.transacciones.filter(t=>t.tipo==='gasto').length);
}

// ── Historial ──
function renderHistorial(tc) {
  const el=document.getElementById('cortes-list');
  if(!el) return;
  if(!tc.cortes.length){el.innerHTML='<div class="empty">No hay cortes anteriores</div>';return;}
  el.innerHTML=[...tc.cortes].reverse().map((c,ri)=>{
    const i=tc.cortes.length-1-ri;
    const txns=c.transacciones||[];
    return `<div class="corte-item">
      <div class="corte-header" data-action="toggle-corte" data-idx="${i}">
        <div><div class="corte-nombre">Corte ${c.fecha}</div>
          <div class="corte-meta">${txns.filter(t=>t.tipo==='gasto').length} gastos · ${txns.filter(t=>t.tipo==='pago').length} pagos</div></div>
        <span class="corte-monto">${fmt(c.total)}</span>
      </div>
      <div class="corte-body" id="cb-${i}">
        ${txns.map(t=>`<div class="corte-txn">
          <span>${t.concepto}</span>
          <span class="${t.tipo==='pago'?'color-success':'color-danger'}">${t.tipo==='pago'?'-':''}${fmt(t.cantidad)}</span>
        </div>`).join('')||'<div class="corte-sin-det">Sin detalle</div>'}
      </div>
    </div>`;
  }).join('');
}

// ── MSI ──
function renderMSI(tc) {
  const el=document.getElementById('msi-list');
  if(!el) return;
  const arr=tc.msi||[];
  if(!arr.length){el.innerHTML='<div class="empty empty--pad">Sin compras a meses registradas</div>';return;}
  el.innerHTML=arr.map((m,i)=>{
    const{pagoMes,fin,mesActual,vigente}=calcMSI(m);
    const badge=vigente?`<span class="badge badge-success">Mes ${mesActual}/${m.meses}</span>`:`<span class="badge badge--terminada">Terminada</span>`;
    return `<div class="msi-item" data-action="editar-msi" data-idx="${i}" role="button" tabindex="0">
      <div class="item-icon">📅</div>
      <div class="item-body"><div class="item-title">${m.concepto}</div>
        <div class="item-subtitle">${fmt(pagoMes)}/mes · hasta ${fmtF(fin)}</div></div>
      ${badge}<span class="item-edit-hint">✏️</span>
    </div>`;
  }).join('');
}

// ── Recurrentes ──
function renderRecurrentes(tc) {
  const el=document.getElementById('rec-list');
  if(!el) return;
  const arr=tc.recurrentes||[];
  if(!arr.length){el.innerHTML='<div class="empty empty--pad">Sin cargos recurrentes</div>';return;}
  el.innerHTML=arr.map((r,i)=>`
    <div class="rec-item" data-action="editar-rec" data-idx="${i}" role="button" tabindex="0">
      <div class="item-icon">🔄</div>
      <div class="item-body"><div class="item-title">${r.concepto}</div>
        <div class="item-subtitle">Día ${r.dia} · ${r.periodo} · ${fmt(r.cantidad)}</div></div>
      <span class="badge badge-warn">${r.periodo}</span>
      <span class="item-edit-hint">✏️</span>
    </div>`).join('');
}

// ── Monedero ──
function renderMonedero(mon) {
  setTxt('mon-nombre-display', mon.nombre);
  setTxt('mon-periodo-display', mon.periodo);
  const total=mon.transacciones.reduce((s,t)=>s+(t.tipo==='gasto'?t.cantidad:0),0);
  setTxt('mon-total', fmt(total));
  const el=document.getElementById('mon-txn-list');
  if(!el) return;
  if(!mon.transacciones.length){el.innerHTML='<div class="empty">Sin movimientos</div>';return;}
  el.innerHTML=[...mon.transacciones].reverse().map((t,ri)=>{
    const i=mon.transacciones.length-1-ri;
    return `<div class="txn-item">
      <div class="txn-icon txn-icon--exp">💵</div>
      <div class="txn-body">
        <div class="txn-header-row"><span class="txn-concept">${t.concepto}</span></div>
        <div class="txn-badges">${t.categoria?`<span class="badge badge-cat">${t.categoria}</span>`:''}</div>
        <div class="txn-date">${t.fecha}</div>
      </div>
      <span class="txn-amount txn-amount--exp">+${fmt(t.cantidad)}</span>
      <button class="del-btn" data-action="eliminar-mon-txn" data-idx="${i}" aria-label="Eliminar">✕</button>
    </div>`;
  }).join('');
}

// ── Estadísticos tarjeta ──
function renderEstadisticosTc(tc) {
  const el=document.getElementById('stats-tc-nombre');
  if(el) el.textContent=tc.nombre;
  // Recopilar gastos de la tarjeta
  const gastos=[];
  tc.transacciones.filter(t=>t.tipo==='gasto'&&!t.esInteres).forEach(t=>gastos.push(t));
  tc.cortes.forEach(c=>(c.transacciones||[]).filter(t=>t.tipo==='gasto'&&!t.esInteres).forEach(t=>gastos.push(t)));
  ['canvas-tc-cat','canvas-tc-tipo'].forEach(id=>{
    const cv=document.getElementById(id);
    if(cv){cv.width=cv.parentElement?.offsetWidth||340;cv.height=cv.width;}
  });
  if(gastos.length){
    dibujarPastelCat('canvas-tc-cat',gastos);
    dibujarPastelTipo('canvas-tc-tipo',gastos);
  }
}

// ── Estadísticos monedero ──
function renderEstadisticosMon(mon) {
  const el=document.getElementById('stats-mon-nombre');
  if(el) el.textContent=mon.nombre;
  const gastos=[];
  mon.transacciones.filter(t=>t.tipo==='gasto').forEach(t=>gastos.push(t));
  mon.cortes.forEach(c=>(c.transacciones||[]).filter(t=>t.tipo==='gasto').forEach(t=>gastos.push(t)));
  ['canvas-mon-cat','canvas-mon-tipo'].forEach(id=>{
    const cv=document.getElementById(id);
    if(cv){cv.width=cv.parentElement?.offsetWidth||340;cv.height=cv.width;}
  });
  if(gastos.length){
    dibujarPastelCat('canvas-mon-cat',gastos);
    dibujarPastelTipo('canvas-mon-tipo',gastos);
  }
}

// ── Estadísticos globales ──
function renderEstadisticosGlobales() {
  const hayElementos=state.tarjetas.length>0||state.monederos.length>0;
  const secGlobal=document.getElementById('aside-stats-global');
  if(secGlobal) secGlobal.classList.toggle('hidden',!hayElementos);
}

// ── Config tarjeta ──
function renderConfigTc(tc) {
  setVal('cfg-nombre',    tc.nombre||'');
  setVal('cfg-limite',    tc.limite||'');
  setVal('cfg-dia-corte', tc.diaCorte||'');
  setVal('cfg-dias-pago', tc.diasPago||20);
  setVal('cfg-tasa-ord',  tc.tasaOrdinaria||'');
  setVal('cfg-tasa-mor',  tc.tasaMoratoria||'');
}

// ── Config monedero ──
function renderConfigMon(mon) {
  setVal('mon-cfg-nombre',  mon.nombre||'');
  setVal('mon-cfg-periodo', mon.periodo||'quincenal');
}

// ── Helpers DOM ──
function setTxt(id,val){ const e=document.getElementById(id); if(e) e.textContent=val; }
function setVal(id,val){ const e=document.getElementById(id); if(e) e.value=val; }

function txnIconClass(t){
  if(t.tipo==='pago')               return 'txn-icon--pay';
  if(t.tipoInteres==='ordinario')   return 'txn-icon--int';
  if(t.tipoInteres==='moratorio')   return 'txn-icon--int';
  if(t.tipoInteres?.startsWith('iva')) return 'txn-icon--iva';
  if(t.esMSI)                       return 'txn-icon--msi';
  if(t.esRec)                       return 'txn-icon--rec';
  return 'txn-icon--exp';
}
function txnIcon(t){
  if(t.tipo==='pago')               return '💳';
  if(t.tipoInteres==='ordinario')   return '📊';
  if(t.tipoInteres==='moratorio')   return '⚠️';
  if(t.tipoInteres?.startsWith('iva')) return '🧾';
  if(t.esMSI)                       return '📅';
  if(t.esRec)                       return '🔄';
  return '🛒';
}
function txnAmountClass(t){
  if(t.tipo==='pago') return 'txn-amount txn-amount--pay';
  if(t.esInteres)     return 'txn-amount txn-amount--int';
  return 'txn-amount txn-amount--exp';
}
function txnBadge(t){
  if(t.esRec)                           return '<span class="badge badge-warn">domiciliación</span>';
  if(t.esMSI)                           return '<span class="badge badge-purple">MSI</span>';
  if(t.tipoInteres==='ordinario')        return '<span class="badge badge-danger">interés ordinario</span>';
  if(t.tipoInteres==='moratorio')        return '<span class="badge badge-danger">interés moratorio</span>';
  if(t.tipoInteres==='iva_ordinario')    return '<span class="badge badge-orange">IVA intereses</span>';
  if(t.tipoInteres==='iva_moratorio')    return '<span class="badge badge-orange">IVA moratorio</span>';
  return '';
}

// ── Toast ──
export function toast(msg,type='success'){
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg; el.className='toast show';
  if(type==='warn'){el.style.background='#fef9ec';el.style.color='#b7770d';el.style.borderColor='#f9e4a0';}
  else{el.style.background='#eafaf1';el.style.color='#1e8449';el.style.borderColor='#a9dfbf';}
  setTimeout(()=>el.classList.remove('show'),2800);
}

// ── Previews ──
export function actualizarPreview(){
  const dia=parseInt(document.getElementById('cfg-dia-corte')?.value);
  const dp=parseInt(document.getElementById('cfg-dias-pago')?.value)||20;
  const prev=document.getElementById('fechas-preview');
  if(!prev) return;
  if(!dia||dia<1||dia>28){prev.classList.add('hidden');return;}
  const hoy=new Date();
  let corte=new Date(hoy.getFullYear(),hoy.getMonth(),dia);
  if(corte<=hoy) corte=new Date(hoy.getFullYear(),hoy.getMonth()+1,dia);
  const pago=new Date(corte); pago.setDate(pago.getDate()+dp);
  prev.classList.remove('hidden');
  prev.innerHTML=`ℹ️ Próximo corte: <strong>${fmtFLarga(corte)}</strong> · Límite: <strong>${fmtFLarga(pago)}</strong>`;
}
export function actualizarPreviewMSI(){
  const monto=parseFloat(document.getElementById('msi-monto')?.value);
  const meses=parseInt(document.getElementById('msi-meses')?.value);
  const fecha=document.getElementById('msi-fecha-inicio')?.value;
  const prev=document.getElementById('msi-preview');
  if(!prev) return;
  if(!monto||!meses||!fecha){prev.classList.add('hidden');return;}
  const fin=new Date(fecha+'T12:00:00');
  fin.setMonth(fin.getMonth()+meses); fin.setDate(fin.getDate()-1);
  prev.classList.remove('hidden');
  prev.innerHTML=`📅 Pago mensual: <strong>${fmt(monto/meses)}</strong> · Termina: <strong>${fmtFLarga(fin)}</strong>`;
}
