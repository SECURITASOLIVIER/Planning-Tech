import { useEffect,useMemo,useRef,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import { ChevronLeft,ChevronRight,ClipboardList,Download,History,Package,Search,UserRound,X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { addSheet,downloadWorkbook,excelDate } from '../lib/excel'
import type { Customer,InventoryItem,Profile,Ticket } from '../lib/types'

type CalendarView='timeGridDay'|'timeGridThreeDay'|'timeGridWeek'|'dayGridMonth'

export function PlanningPage(){
 const {profile}=useAuth()
 const qc=useQueryClient()
 const calendarRef=useRef<FullCalendar|null>(null)
 const [tech,setTech]=useState('')
 const [status,setStatus]=useState('')
 const [search,setSearch]=useState('')
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [mobile,setMobile]=useState(()=>window.innerWidth<=640)
 const [calendarView,setCalendarView]=useState<CalendarView>(()=>window.innerWidth<=640?'timeGridDay':'timeGridWeek')
 const [title,setTitle]=useState('')
 const [visibleStart,setVisibleStart]=useState<Date|null>(null)
 const [visibleEnd,setVisibleEnd]=useState<Date|null>(null)

 useEffect(()=>{
  const onResize=()=>setMobile(window.innerWidth<=640)
  window.addEventListener('resize',onResize)
  return()=>window.removeEventListener('resize',onResize)
 },[])

 const {data:tickets=[]}=useQuery({
  queryKey:['tickets'],
  queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('planned_start');if(error)throw error;return data as Ticket[]}
 })
 const {data:profiles=[]}=useQuery({
  queryKey:['profiles'],
  queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').eq('active',true).order('display_name');if(error)throw error;return data as Profile[]}
 })
 const {data:customers=[]}=useQuery({
  queryKey:['customers','planning'],
  queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').eq('active',true).order('name');if(error)throw error;return data as Customer[]}
 })
 const {data:history=[]}=useQuery({
  queryKey:['planning-history',selectedId],enabled:!!selectedId,
  queryFn:async()=>{const {data,error}=await supabase.from('ticket_history').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false});if(error)throw error;return data||[]}
 })
 const {data:comments=[]}=useQuery({
  queryKey:['planning-comments',selectedId],enabled:!!selectedId,
  queryFn:async()=>{const {data,error}=await supabase.from('ticket_comments').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false});if(error)throw error;return data||[]}
 })
 const {data:movements=[]}=useQuery({
  queryKey:['planning-stock',selectedId],enabled:!!selectedId,
  queryFn:async()=>{const {data,error}=await supabase.from('inventory_movements').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false});if(error)throw error;return data||[]}
 })
 const {data:items=[]}=useQuery({
  queryKey:['inventory','planning'],
  queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').order('model');if(error)throw error;return data as InventoryItem[]}
 })

 const statuses=useMemo(()=>[...new Set(tickets.map(t=>t.status).filter(Boolean))].sort(),[tickets])
 const filtered=useMemo(()=>tickets.filter(t=>{
  if(tech&&t.assigned_to!==tech)return false
  if(status&&t.status!==status)return false
  const q=search.trim().toLowerCase()
  if(q){
   const text=(t.ticket_number+' '+t.subject+' '+(t.requester||'')+' '+(t.description||'')).toLowerCase()
   if(!text.includes(q))return false
  }
  return true
 }),[tickets,tech,status,search])

 const visibleTickets=useMemo(()=>filtered.filter(t=>{
  if(!t.planned_start)return false
  if(!visibleStart||!visibleEnd)return true
  const d=new Date(t.planned_start)
  return d>=visibleStart&&d<visibleEnd
 }),[filtered,visibleStart,visibleEnd])

 const selected=tickets.find(t=>t.id===selectedId)||null
 const techName=(id:string|null|undefined)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const customerName=(id:string|null|undefined)=>customers.find(c=>c.id===id)?.name||'—'

 const events=filtered.filter(t=>t.planned_start).map(t=>({
  id:t.id,
  title:t.ticket_number+' • '+t.subject+' • '+techName(t.assigned_to),
  start:t.planned_start!,
  end:t.planned_end||undefined,
  extendedProps:{status:t.status,tech:t.assigned_to}
 }))

 const move=async(info:any)=>{
  const {error}=await supabase.from('tickets').update({
   planned_start:info.event.start?.toISOString(),
   planned_end:info.event.end?.toISOString()||null
  }).eq('id',info.event.id)
  if(error){info.revert();alert(error.message)}
  else await qc.invalidateQueries({queryKey:['tickets']})
 }

 const api=()=>calendarRef.current?.getApi()
 const changeView=(view:CalendarView)=>{setCalendarView(view);api()?.changeView(view)}
 const previous=()=>api()?.prev()
 const next=()=>api()?.next()
 const today=()=>api()?.today()

 const exportPlanning=()=>{
  const wb=XLSX.utils.book_new()
  addSheet(wb,'Planning filtré',visibleTickets.map(t=>({
   id:t.id,numero_ticket:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client:customerName(t.customer_id),
   description:t.description||'',categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,
   technicien:techName(t.assigned_to),technicien_id:t.assigned_to||'',date_arrivee:excelDate(t.arrival_at),
   debut_planifie:excelDate(t.planned_start),fin_planifie:excelDate(t.planned_end),incident_bloquant:t.is_blocking?'Oui':'Non',
   incident_parent:t.parent_incident||'',incident_general:t.general_incident_label||'',resolution:t.resolution_comment||'',
   date_cloture:excelDate(t.closed_at),cree_par:t.created_by||'',date_creation:excelDate(t.created_at),date_modification:excelDate(t.updated_at),
   customer_id:t.customer_id||'',customer_contact_id:t.customer_contact_id||''
  })))
  addSheet(wb,'Filtres',[{
   vue:calendarView,periode:title,technicien:tech?techName(tech):'Toute équipe',statut:status||'Tous',
   recherche:search||'',nombre_rendez_vous:visibleTickets.length
  }])
  downloadWorkbook(wb,'PlanningSecuritas_Planning_'+new Date().toISOString().slice(0,10)+'.xlsx')
 }

 return <div className="page planning-page">
  <header className="page-head">
   <div><h1>Planning</h1><p>Filtre, déplace et ouvre un rendez-vous pour consulter toutes ses informations.</p></div>
   <button className="secondary page-primary-action" onClick={exportPlanning}><Download size={16}/> Export filtré</button>
  </header>

  <section className="card planning-controls">
   <div className="planning-nav-row">
    <div className="planning-nav-buttons">
     <button className="ghost square-action" onClick={previous} aria-label="Période précédente"><ChevronLeft size={17}/></button>
     <button className="secondary" onClick={today}>Aujourd’hui</button>
     <button className="ghost square-action" onClick={next} aria-label="Période suivante"><ChevronRight size={17}/></button>
    </div>
    <b className="planning-current-title">{title}</b>
    <div className="module-tabs planning-view-tabs">
     <button className={calendarView==='timeGridDay'?'primary':'ghost'} onClick={()=>changeView('timeGridDay')}>Jour</button>
     <button className={calendarView==='timeGridThreeDay'?'primary':'ghost'} onClick={()=>changeView('timeGridThreeDay')}>3 jours</button>
     <button className={calendarView==='timeGridWeek'?'primary':'ghost'} onClick={()=>changeView('timeGridWeek')}>Semaine</button>
     {!mobile&&<button className={calendarView==='dayGridMonth'?'primary':'ghost'} onClick={()=>changeView('dayGridMonth')}>Mois</button>}
    </div>
   </div>

   <div className="planning-filter-row">
    <label className="wide-filter">Recherche<div className="input-with-icon"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ticket, site, demandeur, description…"/></div></label>
    {profile?.role==='manager'&&<label>Technicien<select value={tech} onChange={e=>setTech(e.target.value)}><option value="">Toute l’équipe</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>}
    <label>Statut<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous</option>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
    <span className="planning-result-count">{visibleTickets.length} rendez-vous affiché{visibleTickets.length>1?'s':''}</span>
   </div>
  </section>

  <div className={selected?'planning-layout with-ticket':'planning-layout'}>
   <div>
    <div className="calendar-shell">
     <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin,dayGridPlugin,interactionPlugin]}
      locale={frLocale}
      initialView={calendarView}
      firstDay={1}
      allDaySlot={false}
      slotMinTime="07:00:00"
      slotMaxTime="20:00:00"
      nowIndicator
      height="auto"
      expandRows={false}
      headerToolbar={false}
      views={{timeGridThreeDay:{type:'timeGrid',duration:{days:3},buttonText:'3 jours'}}}
      editable
      selectable
      events={events}
      eventDrop={move}
      eventResize={move}
      eventClick={info=>setSelectedId(info.event.id)}
      datesSet={arg=>{setTitle(arg.view.title);setVisibleStart(arg.start);setVisibleEnd(arg.end);setCalendarView(arg.view.type as CalendarView)}}
      dayHeaderFormat={mobile?{weekday:'short',day:'2-digit',month:'2-digit'}:{weekday:'short',day:'2-digit',month:'2-digit'}}
      eventTimeFormat={{hour:'2-digit',minute:'2-digit',hour12:false}}
     />
    </div>

    <section className="card planning-list-card">
     <div className="module-filter-title"><ClipboardList size={16}/><b>Rendez-vous affichés</b><span>{visibleTickets.length}</span></div>
     <div className="planning-event-list">
      {visibleTickets.length===0&&<span className="muted">Aucun rendez-vous avec ces filtres.</span>}
      {visibleTickets.map(t=><button key={t.id} className={'planning-event-row '+(selectedId===t.id?'selected':'')} onClick={()=>setSelectedId(t.id)}>
       <div><b>{t.ticket_number} • {t.subject}</b><small>{customerName(t.customer_id)} • {techName(t.assigned_to)}</small></div>
       <div><span className="badge">{t.status}</span><small>{t.planned_start?new Date(t.planned_start).toLocaleString('fr-FR'):'—'}</small></div>
      </button>)}
     </div>
    </section>
   </div>

   {selected&&<aside className="panel planning-ticket-panel">
    <div className="detail-panel-head">
     <div><small>Rendez-vous / ticket</small><h2><ClipboardList size={18}/>{selected.ticket_number}</h2></div>
     <button className="ghost small" onClick={()=>setSelectedId(null)}><X size={15}/></button>
    </div>

    <h3 className="planning-ticket-title">{selected.subject}</h3>
    <div className="detail-summary-grid">
     <div><span>Technicien</span><b>{techName(selected.assigned_to)}</b></div>
     <div><span>Client</span><b>{customerName(selected.customer_id)}</b></div>
     <div><span>Demandeur</span><b>{selected.requester||'—'}</b></div>
     <div><span>Statut</span><b>{selected.status}</b></div>
     <div><span>Priorité</span><b>{selected.priority}</b></div>
     <div><span>Catégorie</span><b>{selected.category}</b></div>
     <div><span>Type</span><b>{selected.intervention_type}</b></div>
     <div><span>Bloquant</span><b>{selected.is_blocking?'Oui':'Non'}</b></div>
     <div><span>Début</span><b>{selected.planned_start?new Date(selected.planned_start).toLocaleString('fr-FR'):'—'}</b></div>
     <div><span>Fin</span><b>{selected.planned_end?new Date(selected.planned_end).toLocaleString('fr-FR'):'—'}</b></div>
    </div>
    {selected.description&&<div className="detail-description">{selected.description}</div>}

    <h3 className="section-title"><History size={15}/> Historique ticket</h3>
    <div className="planning-history-list">
     {history.length===0&&<span className="muted">Aucun historique.</span>}
     {history.map((h:any)=><div className="planning-history-row" key={h.id}><b>{h.action}</b><small>{new Date(h.created_at).toLocaleString('fr-FR')}</small><pre>{JSON.stringify(h.details||{},null,2)}</pre></div>)}
    </div>

    <h3 className="section-title"><UserRound size={15}/> Commentaires</h3>
    <div className="planning-history-list">
     {comments.length===0&&<span className="muted">Aucun commentaire.</span>}
     {comments.map((c:any)=><div className="planning-comment-row" key={c.id}><b>{c.author_name||'Utilisateur'}</b><small>{new Date(c.created_at).toLocaleString('fr-FR')}</small><p>{c.body}</p></div>)}
    </div>

    <h3 className="section-title"><Package size={15}/> Matériel / stock</h3>
    <div className="planning-history-list">
     {movements.length===0&&<span className="muted">Aucun mouvement de stock pour ce ticket.</span>}
     {movements.map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return <div className="planning-stock-row" key={m.id}><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'} × {m.quantity}</b><small>{m.reason||m.movement_type} • {new Date(m.created_at).toLocaleString('fr-FR')}</small><span>Stock : {m.old_total??'—'} → {m.new_total??'—'} • Bénéficiaire : {m.assignee||'—'}</span></div>})}
    </div>
   </aside>}
  </div>
 </div>
}
