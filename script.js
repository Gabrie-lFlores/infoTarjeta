
let state={config:{nombre:'Mi tarjeta',
                   limite:0,
                   diaCorte:5,
                   diasPago:20},
           transacciones:[],
           cortes:[],
           saldo:0,
           recurrentes:[]};

// ── IndexedDB ──
const DB_NAME = 'SaldoTarjetaDB';
const DB_VERSION = 1;
const STORE = 'datos';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function saveState() {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.stringify(state), 'tc_v2');
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  } catch(e) {
    // fallback localStorage
    try { localStorage.setItem('tc_v2', JSON.stringify(state)); } catch(_) {}
    console.error('saveState error:', e);
  }
}

async function loadState() {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('tc_v2');
    const data = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    db.close();
    if (data) state = JSON.parse(data);
  } catch(e) {
    // fallback localStorage
    try {
      const r = localStorage.getItem('tc_v2');
      if (r) state = JSON.parse(r);
    } catch(_) {}
    console.error('loadState error:', e);
  }
  checkRecurrentes();
  render();
}

function fmt(n){
    return'$'+parseFloat(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})
}
function fechaHoy(){
    return new Date().toLocaleDateString(
        'es-MX',{day:'2-digit',month:'short',year:'numeric'}
    );
}

function calcFechasCorte(){
  const hoy=new Date();
  const dia=parseInt(state.config.diaCorte)||5;    
  const diasP=parseInt(state.config.diasPago)||20;  
  let fCorte=new Date(hoy.getFullYear(),hoy.getMonth(),dia);
  if(fCorte>hoy)
    fCorte=new Date(hoy.getFullYear(),hoy.getMonth()-1,dia);
  
  const pago=new Date(fCorte);
  pago.setDate(pago.getDate()+diasP);
  const msDay=86400000;
  const diasParaCorte=Math.ceil((fCorte-hoy)/msDay);
  const diasParaPago=Math.ceil((pago-hoy)/msDay);
  return{fCorte,pago,diasParaCorte,diasParaPago};
}

function fmtFecha(fecha){
   
    if (!fecha) return 'Sin fecha'; 

    return fecha.toLocaleDateString('es-MX', {day:'2-digit', month:'long', year:'numeric'});
}

function checkRecurrentes(){
  if(!state.recurrentes||!state.recurrentes.length)return;
  const hoy=new Date();
  const dHoy=hoy.getDate();
  const mesAnio=hoy.getFullYear()*100+hoy.getMonth();
  state.recurrentes.forEach(r=>{
    const key='rec_'+r.id+'_'+mesAnio;
    const yaRegistrado=state.transacciones.some(t=>t.recKey===key);
    if(yaRegistrado)return;
    let debeCargar=false;
    if(r.periodo==='mensual'&&dHoy>=parseInt(r.dia))debeCargar=true;
    else if(r.periodo==='bimestral'&&dHoy>=parseInt(r.dia)&&hoy.getMonth()%2===0)debeCargar=true;
    else if(r.periodo==='trimestral'&&dHoy>=parseInt(r.dia)&&hoy.getMonth()%3===0)debeCargar=true;
    else if(r.periodo==='anual'&&dHoy>=parseInt(r.dia)&&hoy.getMonth()===0)debeCargar=true;
    if(debeCargar){
      state.transacciones.push({tipo:'gasto',concepto:r.concepto+' (recurrente)',cantidad:parseFloat(r.cantidad),fecha:fechaHoy(),recKey:key,auto:true});
    }
  });
}

function saldoUsado(){
  const pagos=state.transacciones.filter(t=>t.tipo==='pago').reduce((s,t)=>s+t.cantidad,0);
  const gastos=state.transacciones.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.cantidad,0);
  return Math.max(0,state.saldo+gastos-pagos);
}
function totalCorteActual(){return state.transacciones.reduce((s,t)=>s+(t.tipo==='gasto'?t.cantidad:-t.cantidad),0)}

function switchTab(t){
  const tabs=['gastos','pagos','historial','cortes','config'];
  document.querySelectorAll('.tab').forEach((el,i)=>
    el.classList.toggle('active',tabs[i]===t));
  document.querySelectorAll('.tab-panel').forEach(el=>
    el.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
}

function render(){
  const cfg=state.config;
  document.getElementById('hdr-sub').textContent=cfg.nombre+(cfg.diaCorte?' · corte día '+cfg.diaCorte:'');
  const usado=saldoUsado();
  const limite=parseFloat(cfg.limite)||0;
  document.getElementById('m-usado').textContent=fmt(usado);
  document.getElementById('m-disp').textContent=limite?fmt(Math.max(0,limite-usado)):'—';

  const {fCorte,pago,diasParaCorte,diasParaPago}=calcFechasCorte();
  document.getElementById('m-dias').textContent=cfg.diaCorte?(diasParaPago>0?diasParaPago+' días':'¡Hoy!'):'—';
  if(diasParaPago<=2&&diasParaPago>=0)document.getElementById('m-dias').className='metric-value danger';
  else if(diasParaPago<=5)document.getElementById('m-dias').className='metric-value warn';
  else document.getElementById('m-dias').className='metric-value warn';

  if(cfg.diaCorte){
    document.getElementById('dc-corte').textContent=fmtFecha(fCorte);
    
    document.getElementById('dc-pago').textContent=fmtFecha(pago);
    document.getElementById('dc-pago-note').textContent='En '+diasParaPago+' día'+(diasParaPago!==1?'s':(diasParaPago===0?'':' '));
  }else{
    document.getElementById('dc-corte').textContent='—';
    document.getElementById('dc-pago').textContent='—';
    document.getElementById('dc-corte-note').textContent='Configura el día de corte';
    document.getElementById('dc-pago-note').textContent='';
  }

  const alerts=document.getElementById('alerts-zone');
  alerts.innerHTML='';
  if(cfg.diaCorte){
    if(diasParaPago===2){
      alerts.innerHTML='<div class="alert-banner alert-warn"><i class="ti ti-bell-ringing" style="font-size:18px" aria-hidden="true"></i><span><strong>Aviso:</strong> Tu fecha límite de pago es en 2 días ('+fmtFecha(pago)+'). No olvides realizar tu pago.</span></div>';
    } else if(diasParaPago===1){
      alerts.innerHTML='<div class="alert-banner alert-danger"><i class="ti ti-alert-triangle" style="font-size:18px" aria-hidden="true"></i><span><strong>¡Mañana es tu fecha límite de pago!</strong> Paga antes del '+fmtFecha(pago)+' para evitar cargos por mora.</span></div>';
    } else if(diasParaPago===0){
      alerts.innerHTML='<div class="alert-banner alert-danger"><i class="ti ti-alert-triangle" style="font-size:18px" aria-hidden="true"></i><span><strong>¡Hoy es tu fecha límite de pago!</strong> Realiza tu pago a la brevedad.</span></div>';
    }
    const recHoy=state.recurrentes&&state.recurrentes.filter(r=>parseInt(r.dia)===new Date().getDate());
    if(recHoy&&recHoy.length){
      const autos=state.transacciones.filter(t=>t.auto&&t.fecha===fechaHoy());
      if(autos.length){
        alerts.innerHTML+='<div class="alert-banner alert-info"><i class="ti ti-repeat" style="font-size:18px" aria-hidden="true"></i><span>Se registraron automáticamente '+autos.length+' cargo(s) recurrente(s) hoy.</span></div>';
      }
    }
  }

  if(limite>0){
    const pct=Math.min(100,(usado/limite)*100);
    const bar=document.getElementById('limit-bar');
    bar.style.width=pct+'%';
    bar.className='bar-fill'+(pct>90?' danger':pct>70?' warn':'');
    document.getElementById('pct-label').textContent=pct.toFixed(1)+'% del límite utilizado';
    document.getElementById('limit-bar-section').style.display='block';
  } else {
    document.getElementById('limit-bar-section').style.display='none';
  }

  const list=document.getElementById('txn-list');
  if(!state.transacciones.length){
    list.innerHTML='<div class="empty">Sin movimientos en este corte</div>';
    document.getElementById('corte-subtotal').style.display='none';
  } else {
    list.innerHTML=[...state.transacciones].reverse().map((t,ri)=>{
      const i=state.transacciones.length-1-ri;
      const isPago=t.tipo==='pago';
      const iconBg=isPago?'var(--color-background-success)':'var(--color-background-info)';
      const iconColor=isPago?'var(--color-text-success)':'var(--color-text-info)';
      const icon=isPago?'ti-arrow-down':(t.auto?'ti-repeat':'ti-shopping-cart');
      const color=isPago?'var(--color-text-success)':'var(--color-text-danger)';
      const signo=isPago?'-':'+';
      const autoBadge=t.auto?'<span class="badge badge-warn" style="font-size:10px;margin-left:4px">auto</span>':'';
      return`<div class="txn-item">
        <div class="txn-icon" style="background:${iconBg}"><i class="ti ${icon}" style="color:${iconColor};font-size:14px" aria-hidden="true"></i></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center"><span class="txn-concept">${t.concepto}</span>${autoBadge}</div>
          <div class="txn-date">${t.fecha}</div>
        </div>
        <span style="font-size:14px;font-weight:500;color:${color};flex-shrink:0">${signo}${fmt(t.cantidad)}</span>
        <button class="del-btn" onclick="eliminarTxn(${i})" aria-label="Eliminar"><i class="ti ti-x" style="font-size:14px" aria-hidden="true"></i></button>
      </div>`;
    }).join('');
    const total=totalCorteActual();
    document.getElementById('corte-total-val').textContent=fmt(Math.max(0,total));
    document.getElementById('corte-subtotal').style.display=total>0?'block':'none';
  }
  document.getElementById('txn-count').textContent=state.transacciones.filter(t=>t.tipo==='gasto').length;

  const cortesEl=document.getElementById('cortes-list');
  if(!state.cortes.length){
    cortesEl.innerHTML='<div class="empty">No hay cortes anteriores</div>';
  } else {
    cortesEl.innerHTML=[...state.cortes].reverse().map((c,ri)=>{
      const i=state.cortes.length-1-ri;
      const txns=c.transacciones||[];
      return`<div class="corte-item">
        <div class="corte-header" onclick="toggleCorte(${i})">
          <div><div style="font-size:13px;font-weight:500;color:var(--color-text-primary)">Corte ${c.fecha}</div><div style="font-size:11px;color:var(--color-text-secondary)">${txns.filter(t=>t.tipo==='gasto').length} gastos · ${txns.filter(t=>t.tipo==='pago').length} pagos</div></div>
          <span style="font-size:14px;font-weight:500;color:var(--color-text-danger)">${fmt(c.total)}</span>
        </div>
        <div class="corte-body" id="cb-${i}">
          ${txns.map(t=>`<div class="corte-txn"><span>${t.concepto}${t.auto?' <em style="font-size:10px;color:var(--color-text-secondary)">(auto)</em>':''}</span><span style="color:${t.tipo==='pago'?'var(--color-text-success)':'var(--color-text-danger)'}">${t.tipo==='pago'?'-':''}${fmt(t.cantidad)}</span></div>`).join('')||'<div style="font-size:12px;color:var(--color-text-secondary);padding:8px 0">Sin detalle</div>'}
        </div>
      </div>`;
    }).join('');
  }

  const recs=state.recurrentes||[];
  const recList=document.getElementById('rec-list');
  if(!recs.length){
    recList.innerHTML='<div class="empty" style="padding:1rem">Sin cargos recurrentes configurados</div>';
  } else {
    recList.innerHTML=recs.map((r,i)=>`<div class="recurrent-item">
      <div class="txn-icon" style="background:var(--color-background-warning)"><i class="ti ti-repeat" style="color:var(--color-text-warning);font-size:14px" aria-hidden="true"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:var(--color-text-primary)">${r.concepto}</div>
        <div style="font-size:11px;color:var(--color-text-secondary)">Día ${r.dia} · ${r.periodo} · ${fmt(r.cantidad)}</div>
      </div>
      <button class="del-btn" onclick="eliminarRec(${i})" aria-label="Eliminar"><i class="ti ti-x" style="font-size:14px" aria-hidden="true"></i></button>
    </div>`).join('');
  }

  document.getElementById('cfg-nombre').value=cfg.nombre||'';
  document.getElementById('cfg-limite').value=cfg.limite||'';
  document.getElementById('cfg-dia-corte').value=cfg.diaCorte||'';
  document.getElementById('cfg-dias-pago').value=cfg.diasPago||20;
  actualizarPreview();
}

function actualizarPreview(){
  const dia=parseInt(document.getElementById('cfg-dia-corte').value);
  const dp=parseInt(document.getElementById('cfg-dias-pago').value)||20;
  const prev=document.getElementById('fechas-preview');
  if(!dia||dia<1||dia>28){prev.style.display='none';return}
  const hoy=new Date();
  let corte=new Date(hoy.getFullYear(),hoy.getMonth(),dia);
  if(corte<=hoy)corte=new Date(hoy.getFullYear(),hoy.getMonth()+1,dia);
  const pago=new Date(corte);pago.setDate(pago.getDate()+dp);
  prev.style.display='block';
  prev.innerHTML=`<i class="ti ti-info-circle" style="font-size:13px" aria-hidden="true"></i> Próximo corte: <strong>${fmtFecha(corte)}</strong> · Fecha límite de pago: <strong>${fmtFecha(pago)}</strong>`;
}

document.getElementById('cfg-dia-corte').addEventListener('input',actualizarPreview);
document.getElementById('cfg-dias-pago').addEventListener('change',actualizarPreview);

function toast(msg,type='success'){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.className='toast show';
  if(type==='warn'){el.style.background='var(--color-background-warning)';el.style.color='var(--color-text-warning)';el.style.borderColor='var(--color-border-warning)';}
  else{el.style.background='var(--color-background-success)';el.style.color='var(--color-text-success)';el.style.borderColor='var(--color-border-success)';}
  setTimeout(()=>el.classList.remove('show'),2800);
}

async function agregarGasto(){
  const c=document.getElementById('inp-concepto').value.trim();
  const q=parseFloat(document.getElementById('inp-cantidad').value);
  if(!c||isNaN(q)||q<=0){toast('Completa concepto y cantidad','warn');return}
  state.transacciones.push({tipo:'gasto',concepto:c,cantidad:q,fecha:fechaHoy()});
  document.getElementById('inp-concepto').value='';
  document.getElementById('inp-cantidad').value='';
  await saveState();render();toast('Gasto registrado');switchTab('historial');
}

async function registrarPago(){
  const q=parseFloat(document.getElementById('inp-pago').value);
  if(isNaN(q)||q<=0){toast('Ingresa un monto válido','warn');return}
  state.transacciones.push({tipo:'pago',concepto:'Pago realizado',cantidad:q,fecha:fechaHoy()});
  document.getElementById('inp-pago').value='';
  await saveState();render();toast('Pago registrado');
}

async function eliminarTxn(i){
  if(!confirm('¿Eliminar este movimiento?'))return;
  state.transacciones.splice(i,1);
  await saveState();render();toast('Movimiento eliminado');
}

async function cerrarCorte(){
  if(!state.transacciones.length){toast('Sin movimientos para cerrar','warn');return}
  if(!confirm('¿Cerrar el corte actual?'))return;
  const total=Math.max(0,totalCorteActual());
  state.saldo=saldoUsado();
  state.cortes.push({fecha:fechaHoy(),total,transacciones:[...state.transacciones]});
  state.transacciones=[];
  await saveState();render();toast('Corte cerrado');switchTab('cortes');
}

async function guardarConfig(){
  state.config.nombre=document.getElementById('cfg-nombre').value.trim()||'Mi tarjeta';
  state.config.limite=parseFloat(document.getElementById('cfg-limite').value)||0;
  state.config.diaCorte=parseInt(document.getElementById('cfg-dia-corte').value)||0;
  state.config.diasPago=parseInt(document.getElementById('cfg-dias-pago').value)||20;
  await saveState();render();toast('Configuración guardada');
}

async function agregarRecurrente(){
  const c=document.getElementById('rec-concepto').value.trim();
  const q=parseFloat(document.getElementById('rec-cantidad').value);
  const dia=parseInt(document.getElementById('rec-dia').value);
  const periodo=document.getElementById('rec-periodo').value;
  if(!c||isNaN(q)||q<=0||!dia||dia<1||dia>28){toast('Completa todos los campos del cargo recurrente','warn');return}
  if(!state.recurrentes)state.recurrentes=[];
  state.recurrentes.push({id:Date.now(),concepto:c,cantidad:q,dia,periodo});
  document.getElementById('rec-concepto').value='';
  document.getElementById('rec-cantidad').value='';
  document.getElementById('rec-dia').value='';
  checkRecurrentes();
  await saveState();render();toast('Cargo recurrente agregado');
}

async function eliminarRec(i){
  if(!confirm('¿Eliminar este cargo recurrente?'))return;
  state.recurrentes.splice(i,1);
  await saveState();render();toast('Cargo eliminado');
}

function toggleCorte(i){const el=document.getElementById('cb-'+i);if(el)el.classList.toggle('open')}

async function resetearDatos(){
  if(!confirm('¿Eliminar TODOS los datos?'))return;
  state={config:{nombre:'Mi tarjeta',limite:0,diaCorte:5,diasPago:20},transacciones:[],cortes:[],saldo:0,recurrentes:[]};
  await saveState();render();toast('Datos eliminados');
}

//Guardar datos
function exportarJSON() {
    const datos = JSON.stringify(state, null, 2);
    const blob = new Blob([datos], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarjeta_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /* ── Importar ── */
  function importarJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const texto = await file.text();
      try {
        state = JSON.parse(texto);
        await saveState();
        render();
        toast('Datos importados correctamente');
      } catch (err) {
        toast('Archivo inválido', 'warn');
      }
    };
    input.click();
  }

loadState();

