(function(){
'use strict';
try {

const SUPABASE_URL='https://ilxdqvbcvcwfklvkyfoj.supabase.co'
const SUPABASE_KEY='sb_publishable_7f0bDxce4zdPCr5_4go4Wg_S6wlEPFY'
if(!window.supabase?.createClient){
 const box=document.getElementById('authMessage')
 if(box){box.textContent='Erreur de chargement Supabase. Recharge la page avec Ctrl+F5.';box.classList.remove('hidden')}
 throw new Error('Supabase JS non chargé')
}
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)

const S={
 session:null,user:null,profile:null,isManager:false,
 tickets:[],profiles:[],config:[],catalog:[],week:startWeek(new Date()),
 current:null,comments:[],materials:[],view:'calendar',configKind:'users',dragId:null
}
const $=id=>document.getElementById(id)
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function startWeek(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function localInput(iso){if(!iso)return'';const d=new Date(iso);return ymd(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function toISO(date,time){return new Date(date+'T'+time+':00').toISOString()}
function localDate(iso){return ymd(new Date(iso))}
function localTime(iso){const d=new Date(iso);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function fmt(iso){return iso?new Date(iso).toLocaleString('fr-FR'):'—'}
function profileName(id){return S.profiles.find(p=>p.id===id)?.display_name||S.profile?.display_name||'Technicien'}
function cfg(kind){return S.config.filter(x=>x.kind===kind&&x.active).sort((a,b)=>a.sort_order-b.sort_order)}
function isClosed(t){return t.status==='Clôturé'}
function statusClass(s){return s==='Clôturé'?'closed':s==='En attente'?'waiting':s==='En cours'?'progress':''}
function badgeClass(s){return s==='Clôturé'?'green':s==='En attente'?'amber':s==='En cours'?'purple':'dark'}

function showAuth(){
 $('authScreen').classList.remove('hidden');$('appScreen').classList.add('hidden')
}
function showApp(){
 $('authScreen').classList.add('hidden');$('appScreen').classList.remove('hidden')
 $('who').innerHTML='<b>'+esc(S.profile.display_name)+'</b><br>'+esc(S.profile.role==='manager'?'Manager':'Technicien')
 document.querySelectorAll('.managerOnly').forEach(el=>el.classList.toggle('hidden',!S.isManager))
 $('newTop').classList.toggle('hidden',!S.isManager)
 showView('calendar')
}
async function init(){
 bindAuth()
 const {data:{session}}=await supabase.auth.getSession()
 if(!session){showAuth();return}
 await enterSession(session)
}
async function enterSession(session){
 S.session=session;S.user=session.user
 const {data,error}=await supabase.from('profiles').select('*').eq('id',S.user.id).single()
 if(error||!data){toast('Profil utilisateur introuvable');await supabase.auth.signOut();showAuth();return}
 if(!data.active){toast('Compte désactivé');await supabase.auth.signOut();showAuth();return}
 S.profile=data;S.isManager=data.role==='manager'
 showApp();await loadAll();subscribeRealtime()
}
function bindAuth(){
 async function loginWithRole(role,email,password){
  const msg=$('authMessage')
  if(msg){msg.textContent='Connexion en cours…';msg.classList.remove('hidden')}
  try{
   const {data,error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
   if(error){
    if(msg)msg.textContent='Connexion refusée : '+error.message
    toast('Connexion refusée : '+error.message)
    return
   }
   if(!data?.user||!data?.session){
    if(msg)msg.textContent='Connexion impossible : aucune session reçue de Supabase.'
    return
   }
   const {data:profile,error:profileError}=await supabase.from('profiles').select('*').eq('id',data.user.id).single()
   if(profileError||!profile){
    await supabase.auth.signOut()
    if(msg)msg.textContent='Connexion réussie, mais le profil applicatif est introuvable : '+(profileError?.message||'profil absent')
    return
   }
   if(!profile.active){
    await supabase.auth.signOut()
    if(msg)msg.textContent='Ce compte est désactivé.'
    return
   }
   if(profile.role!==role){
    await supabase.auth.signOut()
    if(msg)msg.textContent=role==='manager'?'Ce compte existe mais son rôle n’est pas Manager.':'Ce compte existe mais son rôle n’est pas Technicien.'
    return
   }
   if(msg)msg.textContent='Connexion réussie. Chargement de l’application…'
   await enterSession(data.session)
  }catch(err){
   console.error('LOGIN ERROR',err)
   if(msg)msg.textContent='Erreur technique : '+(err?.message||err)
   toast('Erreur technique de connexion')
  }
 }

 // Login forms are handled once in index.html to avoid duplicate sign-in/reload races.
 const setupForm=$('setupForm')
 if(setupForm) setupForm.addEventListener('submit',async e=>{
  e.preventDefault()
  const submit=$('setupSubmit')
  submit.disabled=true;submit.textContent='Création...'
  try{
   const email=$('setupEmail').value.trim().toLowerCase()
   const password=$('setupPassword').value
   const displayName=$('setupName').value.trim()
   const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName}}})
   if(error){toast('Création impossible : '+error.message);return}
   if(data.session){toast('Compte créé. Connexion en cours...');await enterSession(data.session)}
   else toast('Compte créé. Vérifie ton email de confirmation.')
  }finally{
   submit.disabled=false;submit.textContent='Créer mon premier compte Manager'
  }
 })

 $('logout').onclick=async()=>{await supabase.auth.signOut();location.reload()}
}

async function loadAll(){
 const qs=[
  supabase.from('tickets').select('*').order('arrival_at',{ascending:false}),
  supabase.from('config_values').select('*').order('sort_order'),
  supabase.from('materials_catalog').select('*').order('label')
 ]
 if(S.isManager)qs.push(supabase.from('profiles').select('*').order('display_name'))
 else qs.push(supabase.from('profiles').select('*').eq('id',S.user.id))
 const [t,c,m,p]=await Promise.all(qs)
 if(t.error)toast(t.error.message)
 S.tickets=t.data||[];S.config=c.data||[];S.catalog=m.data||[];S.profiles=p.data||[]
 renderAll()
}
function subscribeRealtime(){
 supabase.channel('itsm-live')
  .on('postgres_changes',{event:'*',schema:'public',table:'tickets'},()=>loadAll())
  .on('postgres_changes',{event:'*',schema:'public',table:'ticket_comments'},()=>{if(S.current)openTicket(S.current.id,false)})
  .subscribe()
}

function fillSelect(el,items,valueField='label',labelField='label',all=''){
 const old=el.value
 el.innerHTML=(all?'<option value="">'+esc(all)+'</option>':'')+items.map(x=>'<option value="'+esc(x[valueField])+'">'+esc(x[labelField])+'</option>').join('')
 if([...el.options].some(o=>o.value===old))el.value=old
}
function populateFilters(){
 fillSelect($('techFilter'),S.profiles,'id','display_name','Tous les techniciens')
 fillSelect($('listTechFilter'),S.profiles,'id','display_name','Tous les techniciens')
 fillSelect($('statusFilter'),cfg('status'),'label','label','Tous les statuts')
 fillSelect($('listStatusFilter'),cfg('status'),'label','label','Tous les statuts')
 $('navTicketCount').textContent=S.tickets.length
 $('blockingCount').textContent=S.tickets.filter(t=>t.is_blocking&&!isClosed(t)).length
 $('waitingCount').textContent=S.tickets.filter(t=>t.status==='En attente').length
 $('closedCount').textContent=S.tickets.filter(isClosed).length
}
function calendarTickets(){
 const tech=$('techFilter').value,st=$('statusFilter').value
 return S.tickets.filter(t=>(!tech||t.assigned_to===tech)&&(!st||t.status===st))
}
function renderCalendar(){
 const days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],today=ymd(new Date()),list=calendarTickets()
 $('weekTitle').innerHTML=S.week.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+' → '+addDays(S.week,6).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'<small>'+list.length+' intervention(s)</small>'
 let h='<div class="calHead"><div class="corner">Heure</div>'
 for(let i=0;i<7;i++){const d=addDays(S.week,i),ds=ymd(d);h+='<div class="dayHead '+(ds===today?'today':'')+'"><b>'+days[i]+'</b><strong>'+d.getDate()+'</strong></div>'}
 h+='</div>'
 for(let hr=7;hr<=19;hr++){
  h+='<div class="calRow"><div class="hour">'+String(hr).padStart(2,'0')+':00</div>'
  for(let i=0;i<7;i++){
   const date=ymd(addDays(S.week,i));h+='<div class="slot" data-date="'+date+'" data-hour="'+String(hr).padStart(2,'0')+':00">'
   list.filter(t=>t.planned_start&&localDate(t.planned_start)===date&&new Date(t.planned_start).getHours()===hr).forEach(t=>{
    h+='<button class="ticket '+statusClass(t.status)+' '+(t.is_blocking?'blocking':'')+'" draggable="'+(!isClosed(t)?'true':'false')+'" data-id="'+t.id+'"><b>'+esc(localTime(t.planned_start))+' '+esc(t.ticket_number)+'</b><div class="subject">'+esc(t.subject)+'</div><small><span>'+esc(profileName(t.assigned_to))+'</span><span>'+esc(t.status)+'</span></small></button>'
   })
   h+='</div>'
  }h+='</div>'
 }
 $('calendar').innerHTML=h
 document.querySelectorAll('.ticket').forEach(el=>{
  el.onclick=()=>openTicket(el.dataset.id)
  el.ondragstart=e=>{S.dragId=el.dataset.id;e.dataTransfer.setData('text/plain',S.dragId)}
 })
 document.querySelectorAll('.slot').forEach(el=>{
  el.ondblclick=()=>{if(S.isManager)openNew(el.dataset.date,el.dataset.hour)}
  el.ondragover=e=>{e.preventDefault();el.classList.add('dragover')}
  el.ondragleave=()=>el.classList.remove('dragover')
  el.ondrop=async e=>{e.preventDefault();el.classList.remove('dragover');await moveTicket(S.dragId,el.dataset.date,el.dataset.hour)}
 })
 renderTopKpis()
}
async function moveTicket(id,date,time){
 const t=S.tickets.find(x=>x.id===id);if(!t||isClosed(t))return
 if(!S.isManager&&t.assigned_to!==S.user.id)return
 const dur=(new Date(t.planned_end)-new Date(t.planned_start))/60000||60
 const start=new Date(date+'T'+time+':00'),end=new Date(start.getTime()+dur*60000)
 const {error}=await supabase.from('tickets').update({planned_start:start.toISOString(),planned_end:end.toISOString()}).eq('id',id)
 if(error)toast(error.message);else toast('Planning déplacé')
}
function renderTopKpis(){
 const t=calendarTickets(),vals=[
  ['Tickets',t.length,''],['Nouveaux',t.filter(x=>x.status==='Nouveau').length,''],['En cours',t.filter(x=>x.status==='En cours').length,'purple'],
  ['En attente',t.filter(x=>x.status==='En attente').length,'amber'],['Bloquants',t.filter(x=>x.is_blocking&&!isClosed(x)).length,'red'],['Clôturés',t.filter(isClosed).length,'green']
 ]
 $('topKpis').innerHTML=vals.map(x=>'<div class="kpi '+x[2]+'"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')
}
function filteredList(){
 const q=$('globalSearch').value.trim().toLowerCase(),tech=$('listTechFilter').value,st=$('listStatusFilter').value
 return S.tickets.filter(t=>{
  if(tech&&t.assigned_to!==tech)return false;if(st&&t.status!==st)return false
  if(S.quick==='blocking'&&!(t.is_blocking&&!isClosed(t)))return false
  if(S.quick==='waiting'&&t.status!=='En attente')return false
  if(S.quick==='closed'&&!isClosed(t))return false
  return !q||[t.ticket_number,t.subject,t.requester,t.parent_incident,t.general_incident_label,t.category,profileName(t.assigned_to)].join(' ').toLowerCase().includes(q)
 })
}
function renderTickets(){
 const rows=filteredList()
 $('ticketList').innerHTML=rows.length?rows.map(t=>'<button class="listRow" data-id="'+t.id+'"><div><b style="color:#1669b0">'+esc(t.ticket_number)+'</b></div><div class="subjectLine"><b>'+esc(t.subject)+'</b><small>'+esc(t.requester||'Sans utilisateur')+' • '+esc(t.category)+' • '+esc(t.intervention_type)+'</small></div><div>'+esc(profileName(t.assigned_to))+'</div><div><span class="badge '+badgeClass(t.status)+'">'+esc(t.status)+'</span></div><div><span class="badge '+(t.priority==='Urgente'?'red':'dark')+'">'+esc(t.priority)+'</span></div><div>'+(t.is_blocking?'<span class="badge red">Oui</span>':'Non')+'</div><div><small>'+esc(fmt(t.arrival_at))+'</small></div><div>'+esc(t.parent_incident||'—')+'</div></button>').join(''):'<div style="padding:28px;text-align:center;color:var(--muted)">Aucun ticket.</div>'
 document.querySelectorAll('.listRow').forEach(b=>b.onclick=()=>openTicket(b.dataset.id))
}
function renderKPI(){
 const a=S.tickets,vals=[['Total',a.length,''],['Ouverts',a.filter(t=>!isClosed(t)&&t.status!=='Annulé').length,''],['En cours',a.filter(t=>t.status==='En cours').length,'purple'],['En attente',a.filter(t=>t.status==='En attente').length,'amber'],['Bloquants',a.filter(t=>t.is_blocking&&!isClosed(t)).length,'red'],['Clôturés',a.filter(isClosed).length,'green']]
 $('kpiCards').innerHTML=vals.map(x=>'<div class="kpi '+x[2]+'"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')
 $('techKpi').innerHTML=S.profiles.map(p=>{const x=a.filter(t=>t.assigned_to===p.id);return '<tr><td><b>'+esc(p.display_name)+'</b></td><td>'+x.length+'</td><td>'+x.filter(t=>t.status==='En cours').length+'</td><td>'+x.filter(t=>t.status==='En attente').length+'</td><td>'+x.filter(t=>t.is_blocking&&!isClosed(t)).length+'</td><td>'+x.filter(isClosed).length+'</td></tr>'}).join('')
}
function showView(v){
 if(!S.isManager&&['kpi','users','config'].includes(v))v='calendar'
 S.view=v;document.querySelectorAll('.nav[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v))
 ;['calendar','tickets','kpi','users','config'].forEach(x=>$(x+'View').classList.toggle('hidden',x!==v))
 if(v==='tickets')renderTickets();if(v==='kpi')renderKPI();if(v==='users')renderUsers();if(v==='config')renderConfig()
}

async function openNew(date=ymd(new Date()),time='09:00'){
 if(!S.isManager)return
 S.current=null;S.comments=[];S.materials=[]
 $('ticketForm').reset();$('ticketId').value='';$('ticketNumber').value='INC-'+String(Date.now()).slice(-8);$('arrivalAt').value=localInput(new Date().toISOString());$('plannedDate').value=date;$('plannedStart').value=time
 const [hh,mm]=time.split(':').map(Number);$('plannedEnd').value=String(Math.min(hh+1,23)).padStart(2,'0')+':'+String(mm).padStart(2,'0')
 fillTicketSelects();$('commentSection').classList.add('hidden');$('deleteTicketBtn').classList.add('hidden');$('reopenTicketBtn').classList.add('hidden');$('closeTicketBtn').classList.remove('hidden');$('closedInfo').classList.add('hidden')
 renderMaterialRows([]);$('panelTitle').textContent='Nouveau ticket';$('panelMeta').textContent='Création manager';setTicketPermissions();$('ticketOverlay').classList.add('open')
}
function fillTicketSelects(){
 fillSelect($('ticketTech'),S.profiles.filter(p=>p.active),'id','display_name')
 fillSelect($('ticketStatus'),cfg('status'));fillSelect($('ticketPriority'),cfg('priority'));fillSelect($('ticketCategory'),cfg('category'));fillSelect($('ticketType'),cfg('type'))
}
async function openTicket(id,open=true){
 const t=S.tickets.find(x=>x.id===id);if(!t)return
 S.current=t;fillTicketSelects()
 const [c,m]=await Promise.all([supabase.from('ticket_comments').select('*').eq('ticket_id',id).order('created_at',{ascending:false}),supabase.from('ticket_materials').select('*').eq('ticket_id',id).order('created_at')])
 S.comments=c.data||[];S.materials=m.data||[]
 $('ticketId').value=t.id;$('ticketNumber').value=t.ticket_number;$('arrivalAt').value=localInput(t.arrival_at);$('ticketTech').value=t.assigned_to||'';$('ticketStatus').value=t.status;$('ticketPriority').value=t.priority;$('ticketCategory').value=t.category;$('ticketType').value=t.intervention_type
 $('parentIncident').value=t.parent_incident||'';$('isBlocking').checked=t.is_blocking;$('ticketSubject').value=t.subject;$('ticketUser').value=t.requester||'';$('generalIncidentLabel').value=t.general_incident_label||'';$('ticketDescription').value=t.description||''
 $('plannedDate').value=t.planned_start?localDate(t.planned_start):ymd(new Date());$('plannedStart').value=t.planned_start?localTime(t.planned_start):'09:00';$('plannedEnd').value=t.planned_end?localTime(t.planned_end):'10:00';$('resolutionComment').value=t.resolution_comment||''
 $('panelTitle').textContent=t.ticket_number+' — '+t.subject;$('panelMeta').textContent='Arrivé : '+fmt(t.arrival_at)+' • '+profileName(t.assigned_to)
 $('commentSection').classList.remove('hidden');renderComments();renderMaterialRows(S.materials)
 const closed=isClosed(t);$('deleteTicketBtn').classList.toggle('hidden',!S.isManager||closed);$('reopenTicketBtn').classList.toggle('hidden',!S.isManager||!closed);$('closeTicketBtn').classList.toggle('hidden',closed)
 $('closedInfo').classList.toggle('hidden',!closed);if(closed)$('closedInfo').textContent='Clôturé le '+fmt(t.closed_at)+' — ticket conservé dans l’historique.'
 setTicketPermissions();if(open)$('ticketOverlay').classList.add('open')
}
function setTicketPermissions(){
 const canEdit=S.isManager||(!S.isManager&&S.current&&S.current.assigned_to===S.user.id&&!isClosed(S.current))
 ;['ticketStatus','ticketPriority','ticketCategory','ticketType','parentIncident','isBlocking','ticketSubject','ticketUser','generalIncidentLabel','ticketDescription','plannedDate','plannedStart','plannedEnd','resolutionComment'].forEach(id=>$(id).disabled=!canEdit)
 $('ticketTech').disabled=!S.isManager;$('ticketNumber').disabled=!S.isManager;$('arrivalAt').disabled=!S.isManager
 $('saveTicketBtn').classList.toggle('hidden',!canEdit);$('addMaterialBtn').classList.toggle('hidden',!canEdit)
}
function renderComments(){
 $('commentsList').innerHTML=S.comments.length?S.comments.map(c=>'<div class="comment"><b>'+esc(c.author_name||'Utilisateur')+'</b><time>'+esc(fmt(c.created_at))+'</time><p>'+esc(c.body)+'</p></div>').join(''):'<div class="muted" style="font-size:11px">Aucun commentaire.</div>'
}
function renderMaterialRows(items){
 $('materialsBox').innerHTML=''
 ;(items.length?items:[{label:'',quantity:1,note:''}]).forEach(addMaterialRow)
}
function addMaterialRow(item={label:'',quantity:1,note:''}){
 const row=document.createElement('div');row.className='materialRow'
 row.innerHTML='<select class="input matLabel"><option value="">— Matériel libre —</option>'+S.catalog.filter(x=>x.active).map(x=>'<option '+(x.label===item.label?'selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select><input class="input matQty" type="number" min="1" value="'+(item.quantity||1)+'"><input class="input matNote" value="'+esc(item.note||'')+'" placeholder="Détail / matériel libre"><button type="button" class="btn danger small matDel">✕</button>'
 row.querySelector('.matDel').onclick=()=>row.remove();$('materialsBox').appendChild(row)
}
function collectMaterials(){
 return [...document.querySelectorAll('#materialsBox .materialRow')].map(r=>{const s=r.querySelector('.matLabel').value,n=r.querySelector('.matNote').value.trim();return{label:s||n,quantity:Math.max(1,Number(r.querySelector('.matQty').value)||1),note:n}}).filter(x=>x.label)
}
async function saveMaterials(ticketId){
 const rows=collectMaterials()
 const del=await supabase.from('ticket_materials').delete().eq('ticket_id',ticketId);if(del.error)throw del.error
 if(rows.length){const ins=await supabase.from('ticket_materials').insert(rows.map(x=>({ticket_id:ticketId,label:x.label,quantity:x.quantity,note:x.note})));if(ins.error)throw ins.error}
}
async function saveTicket(e){
 e.preventDefault()
 const closed=$('ticketStatus').value==='Clôturé',resolution=$('resolutionComment').value.trim()
 if(closed&&!resolution){toast('Commentaire de résolution obligatoire.');return}
 const data={ticket_number:$('ticketNumber').value.trim(),subject:$('ticketSubject').value.trim(),requester:$('ticketUser').value.trim(),description:$('ticketDescription').value.trim(),category:$('ticketCategory').value,intervention_type:$('ticketType').value,status:$('ticketStatus').value,priority:$('ticketPriority').value,assigned_to:$('ticketTech').value||S.user.id,arrival_at:new Date($('arrivalAt').value).toISOString(),planned_start:toISO($('plannedDate').value,$('plannedStart').value),planned_end:toISO($('plannedDate').value,$('plannedEnd').value),is_blocking:$('isBlocking').checked,parent_incident:$('parentIncident').value.trim(),general_incident_label:$('generalIncidentLabel').value.trim(),resolution_comment:resolution}
 try{
  let id=$('ticketId').value
  if(id){if(!S.isManager)delete data.assigned_to;const r=await supabase.from('tickets').update(data).eq('id',id).select().single();if(r.error)throw r.error;await saveMaterials(id)}
  else{data.created_by=S.user.id;const r=await supabase.from('tickets').insert(data).select().single();if(r.error)throw r.error;id=r.data.id;await saveMaterials(id)}
  $('ticketOverlay').classList.remove('open');toast('Ticket enregistré');await loadAll()
 }catch(err){toast(err.message)}
}
async function addComment(){
 const body=$('newComment').value.trim();if(!body||!S.current)return
 const {error}=await supabase.from('ticket_comments').insert({ticket_id:S.current.id,author_id:S.user.id,body})
 if(error)toast(error.message);else{$('newComment').value='';await openTicket(S.current.id,false);toast('Commentaire ajouté')}
}
async function closeTicket(){
 if(!S.current)return;const r=$('resolutionComment').value.trim();if(!r){toast('Ajoute le commentaire de résolution.');return}
 const {error}=await supabase.from('tickets').update({status:'Clôturé',resolution_comment:r}).eq('id',S.current.id)
 if(error)toast(error.message);else{toast('Ticket clôturé et conservé');await loadAll();await openTicket(S.current.id,false)}
}
async function reopenTicket(){
 if(!S.isManager||!S.current)return
 const target=cfg('status').some(x=>x.label==='En cours')?'En cours':cfg('status').find(x=>x.label!=='Clôturé')?.label
 const {error}=await supabase.from('tickets').update({status:target}).eq('id',S.current.id);if(error)toast(error.message);else{await loadAll();await openTicket(S.current.id,false);toast('Ticket réouvert')}
}
async function deleteTicket(){
 if(!S.isManager||!S.current||isClosed(S.current))return
 if(!confirm('Supprimer ce ticket non clôturé ?'))return
 const {error}=await supabase.from('tickets').delete().eq('id',S.current.id);if(error)toast(error.message);else{$('ticketOverlay').classList.remove('open');await loadAll();toast('Ticket supprimé')}
}

function renderUsers(){
 $('usersBody').innerHTML=S.profiles.map(p=>'<tr><td><b>'+esc(p.display_name)+'</b><br><small>'+esc(p.email||'')+'</small></td><td><select class="select userRole" data-id="'+p.id+'"><option value="technician" '+(p.role==='technician'?'selected':'')+'>Technicien</option><option value="manager" '+(p.role==='manager'?'selected':'')+'>Manager</option></select></td><td><input class="input userStart" data-id="'+p.id+'" type="time" value="'+esc(p.work_start?.slice(0,5)||'08:00')+'"></td><td><input class="input userEnd" data-id="'+p.id+'" type="time" value="'+esc(p.work_end?.slice(0,5)||'17:00')+'"></td><td><button class="btn small '+(p.active?'success':'danger')+' toggleUser" data-id="'+p.id+'">'+(p.active?'Actif':'Désactivé')+'</button></td></tr>').join('')
 document.querySelectorAll('.userRole').forEach(x=>x.onchange=()=>updateProfile(x.dataset.id,{role:x.value}))
 document.querySelectorAll('.userStart').forEach(x=>x.onchange=()=>updateProfile(x.dataset.id,{work_start:x.value}))
 document.querySelectorAll('.userEnd').forEach(x=>x.onchange=()=>updateProfile(x.dataset.id,{work_end:x.value}))
 document.querySelectorAll('.toggleUser').forEach(x=>x.onclick=()=>{const p=S.profiles.find(y=>y.id===x.dataset.id);if(p.id===S.user.id){toast('Tu ne peux pas désactiver ton propre compte.');return}updateProfile(p.id,{active:!p.active})})
}
async function updateProfile(id,patch){const {error}=await supabase.from('profiles').update(patch).eq('id',id);if(error)toast(error.message);else{toast('Utilisateur mis à jour');await loadAll();renderUsers()}}
async function createUser(e){
 e.preventDefault()
 const body={email:$('newUserEmail').value.trim(),display_name:$('newUserName').value.trim(),password:$('newUserPassword').value,role:$('newUserRole').value}
 const {data,error}=await supabase.functions.invoke('manager-create-user',{body})
 if(error){toast(error.message);return}if(data?.error){toast(data.error);return}
 $('newUserForm').reset();toast('Compte créé : '+data.user.email);await loadAll();renderUsers()
}

function renderConfig(){
 const kinds=[['category','Catégories'],['type',"Types d'intervention"],['status','Statuts'],['priority','Priorités'],['materials','Matériel']]
 $('configTabs').innerHTML=kinds.map(x=>'<button class="'+(S.configKind===x[0]?'active':'')+'" data-kind="'+x[0]+'">'+x[1]+'</button>').join('')
 document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{S.configKind=b.dataset.kind;renderConfig()})
 if(S.configKind==='materials'){
  $('configPanel').innerHTML='<h3>Catalogue matériel</h3><div class="addRow"><input id="cfgNew" class="input" placeholder="Nouveau matériel"><button id="cfgAdd" class="btn primary">Ajouter</button></div><div class="configList">'+S.catalog.map(x=>'<div class="configRow"><input class="input cfgMat" data-id="'+x.id+'" value="'+esc(x.label)+'"><span>'+S.tickets.length+' tickets</span><button class="btn danger small cfgDelMat" data-id="'+x.id+'">Supprimer</button></div>').join('')+'</div>'
  $('cfgAdd').onclick=()=>addMaterialCatalog($('cfgNew').value.trim())
  document.querySelectorAll('.cfgMat').forEach(x=>x.onchange=()=>updateMaterialCatalog(x.dataset.id,x.value.trim()))
  document.querySelectorAll('.cfgDelMat').forEach(x=>x.onclick=()=>deleteMaterialCatalog(x.dataset.id))
 }else{
  const rows=cfg(S.configKind)
  $('configPanel').innerHTML='<h3>Configuration</h3><div class="addRow"><input id="cfgNew" class="input" placeholder="Nouvelle valeur"><button id="cfgAdd" class="btn primary">Ajouter</button></div><div class="configList">'+rows.map(x=>'<div class="configRow"><input class="input cfgVal" data-id="'+x.id+'" data-old="'+esc(x.label)+'" value="'+esc(x.label)+'"><span>'+usage(S.configKind,x.label)+' utilisé(s)</span><button class="btn danger small cfgDel" data-id="'+x.id+'" data-label="'+esc(x.label)+'">Supprimer</button></div>').join('')+'</div>'
  $('cfgAdd').onclick=()=>addConfigValue(S.configKind,$('cfgNew').value.trim())
  document.querySelectorAll('.cfgVal').forEach(x=>x.onchange=()=>renameConfigValue(x.dataset.id,S.configKind,x.dataset.old,x.value.trim()))
  document.querySelectorAll('.cfgDel').forEach(x=>x.onclick=()=>deleteConfigValue(x.dataset.id,S.configKind,x.dataset.label))
 }
}
function usage(kind,label){const f={category:'category',type:'intervention_type',status:'status',priority:'priority'}[kind];return S.tickets.filter(t=>t[f]===label).length}
async function addConfigValue(kind,label){if(!label)return;const max=Math.max(0,...cfg(kind).map(x=>x.sort_order));const {error}=await supabase.from('config_values').insert({kind,label,sort_order:max+10});if(error)toast(error.message);else{await loadAll();renderConfig()}}
async function renameConfigValue(id,kind,oldv,newv){
 if(!newv||newv===oldv)return;const f={category:'category',type:'intervention_type',status:'status',priority:'priority'}[kind]
 const c=await supabase.from('config_values').update({label:newv}).eq('id',id);if(c.error){toast(c.error.message);return}
 if(f){const u=await supabase.from('tickets').update({[f]:newv}).eq(f,oldv);if(u.error)toast(u.error.message)}
 await loadAll();renderConfig();toast('Valeur renommée')
}
async function deleteConfigValue(id,kind,label){if(usage(kind,label)){toast('Réaffecte d’abord les tickets utilisant cette valeur.');return}const {error}=await supabase.from('config_values').delete().eq('id',id);if(error)toast(error.message);else{await loadAll();renderConfig()}}
async function addMaterialCatalog(label){if(!label)return;const {error}=await supabase.from('materials_catalog').insert({label});if(error)toast(error.message);else{await loadAll();renderConfig()}}
async function updateMaterialCatalog(id,label){if(!label)return;const {error}=await supabase.from('materials_catalog').update({label}).eq('id',id);if(error)toast(error.message);else{await loadAll();renderConfig()}}
async function deleteMaterialCatalog(id){const {error}=await supabase.from('materials_catalog').delete().eq('id',id);if(error)toast(error.message);else{await loadAll();renderConfig()}}

async function exportExcel(){
 try{
  const XLSX=await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm')
  const [comments,materials,history]=await Promise.all([supabase.from('ticket_comments').select('*').order('created_at'),supabase.from('ticket_materials').select('*').order('created_at'),supabase.from('ticket_history').select('*').order('created_at')])
  const ticketRows=S.tickets.map(t=>({Numero:t.ticket_number,Titre:t.subject,Utilisateur:t.requester,Technicien:profileName(t.assigned_to),Statut:t.status,Priorite:t.priority,Categorie:t.category,Type:t.intervention_type,Bloquant:t.is_blocking?'Oui':'Non',Incident_parent:t.parent_incident,Arrivee:fmt(t.arrival_at),Debut:fmt(t.planned_start),Fin:fmt(t.planned_end),Resolution:t.resolution_comment,Cloture:fmt(t.closed_at)}))
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ticketRows),'Tickets')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((comments.data||[]).map(c=>({Ticket:c.ticket_id,Auteur:c.author_name,Commentaire:c.body,Date:fmt(c.created_at)}))),'Commentaires')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.profiles.map(p=>({Nom:p.display_name,Email:p.email,Role:p.role,Actif:p.active?'Oui':'Non',Debut:p.work_start,Fin:p.work_end}))),'Techniciens')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(materials.data||[]),'Materiel')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(history.data||[]),'Historique')
  XLSX.writeFile(wb,'SuperSupportIT_Base_'+ymd(new Date())+'.xlsx');toast('Export Excel généré')
 }catch(e){toast('Export Excel impossible : '+e.message)}
}

function renderAll(){populateFilters();renderCalendar();renderTickets();if(S.isManager){renderKPI();if(S.view==='users')renderUsers();if(S.view==='config')renderConfig()}}
function bindApp(){
 document.querySelectorAll('.nav[data-view]').forEach(b=>b.onclick=()=>{S.quick=null;showView(b.dataset.view)})
 $('quickBlocking').onclick=()=>{S.quick='blocking';showView('tickets');renderTickets()}
 $('quickWaiting').onclick=()=>{S.quick='waiting';showView('tickets');renderTickets()}
 $('quickClosed').onclick=()=>{S.quick='closed';showView('tickets');renderTickets()}
 $('globalSearch').oninput=()=>{if($('globalSearch').value.trim())showView('tickets');renderTickets()}
 $('newTop').onclick=$('newList').onclick=$('planTicket').onclick=()=>openNew()
 $('prevWeek').onclick=()=>{S.week=addDays(S.week,-7);renderCalendar()};$('nextWeek').onclick=()=>{S.week=addDays(S.week,7);renderCalendar()};$('todayWeek').onclick=()=>{S.week=startWeek(new Date());renderCalendar()}
 $('techFilter').onchange=$('statusFilter').onchange=renderCalendar;$('listTechFilter').onchange=$('listStatusFilter').onchange=renderTickets
 $('ticketForm').addEventListener('submit',saveTicket);$('addCommentBtn').onclick=addComment;$('closeTicketBtn').onclick=closeTicket;$('reopenTicketBtn').onclick=reopenTicket;$('deleteTicketBtn').onclick=deleteTicket;$('addMaterialBtn').onclick=()=>addMaterialRow()
 $('closePanel').onclick=()=>$('ticketOverlay').classList.remove('open');$('ticketOverlay').onclick=e=>{if(e.target===$('ticketOverlay'))$('ticketOverlay').classList.remove('open')}
 $('newUserForm').addEventListener('submit',createUser);$('exportExcel').onclick=exportExcel
}

window.SSI_SUPABASE=supabase;
window.enterSession=enterSession;
window.SSI_APP_LOADED=true;

bindApp();
init().catch(err=>{
  console.error('SSI INIT ERROR',err);
  const box=document.getElementById('authMessage');
  if(box){
    box.textContent='Erreur initialisation application : '+(err?.message||err);
    box.classList.remove('hidden');
  }
});
} catch(err) {
  console.error('SSI BOOT ERROR',err);
  window.SSI_BOOT_ERROR=String(err?.message||err);
  const box=document.getElementById('authMessage');
  if(box){
    box.textContent='Erreur chargement application : '+(err?.message||err);
    box.classList.remove('hidden');
  }
}
})();