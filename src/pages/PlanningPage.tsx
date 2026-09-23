import { useEffect,useMemo,useRef,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import { ChevronLeft,ChevronRight,ClipboardList,Clock3,Download,History,Package,Search,UserRound } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { addSheet,downloadWorkbook,excelDate } from '../lib/excel'
import { notify } from '../lib/notify'
import { DetailDrawer } from '../components/DetailDrawer'
import type { Customer,InventoryItem,Profile,Ticket } from '../lib/types'

type CalendarView='timeGridDay'|'timeGridWeek'|'dayGridMonth'
const palette=['#1473e6','#00a878','#8b5cf6','#e67e22','#d32f5e','#0097a7','#5c6bc0','#6d8f00','#c44536','#7a4fb7']

export function PlanningPage(){
 const {profile}=useAuth()
 const qc=useQueryClient()
 const calendarRef=useRef<FullCalendar|null>(null)
 const [tech,setTech]=useState('')
 const [status,setStatus]=useState('')
 const [search,setSearch]=useState('')
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [calendarView,setCalendarView]=useState<CalendarView>(()=>window.innerWidth<=640?'timeGridDay':'timeGridWeek')
 const [title,setTitle]=useState('')
 const [visibleStart,setVisibleStart]=useState<Date|null>(null)
 const [visibleEnd,setVisibleEnd]=useState<Date|null>(null)
 const [fullDay,setFullDay]=useState(()=>localStorage.getItem('planning-hours-mode')==='24h')

 useEffect(()=>{
  localStorage.setItem('planning-hours-mode',fullDay?'24h':'7-19')
 },[fullDay])

 const {data:tickets=[]}=useQuery({queryKey:['tickets'],queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('planned_start');if(error)throw error;return data as Ticket[]}})
 const {data:profiles=[]}=useQuery({queryKey:['profiles'],queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').eq('active',true).order('display_name');if(error)throw error;return data as Profile[]}})
 const {data:customers=[]}=useQuery({queryKey:['customers','planning'],queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').eq('active',true).order('name');if(error)throw error;return data as Customer[]}})
 const {data:history=[]}=useQuery({queryKey:['planning-history',selectedId],enabled:!!selectedId,queryFn:async()=>{const {data,error}=await supabase.from('ticket_history').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:comments=[]}=useQuery({queryKey:['planning-comments',selectedId],enabled:!!selectedId,queryFn:async()=>{const {data,error}=await supabase.from('ticket_comments').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:movements=[]}=useQuery({queryKey:['planning-stock',selectedId],enabled:!!selectedId,queryFn:async()=>{const {data,error}=await supabase.from('inventory_movements').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:items=[]}=useQuery({queryKey:['inventory','planning'],queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').order('model');if(error)throw error;return data as InventoryItem[]}})

 const statuses=useMemo(()=>[...new Set(tickets.map(t=>t.status).filter(Boolean))].sort(),[tickets])
 const filtered=useMemo(()=>tickets.filter(t=>{
  if(tech&&t.assigned_to!==tech)return false
  if(status&&t.status!==status)return false
  const q=search.trim().toLowerCase()
  return !q||(t.ticket_number+' '+t.subject+' '+(t.requester||'')+' '+(t.description||'')).toLowerCase().includes(q)
 }),[tickets,tech,status,search])

 const visibleTickets=useMemo(()=>filtered.filter(t=>{
  if(!t.planned_start)return false
  if(!visibleStart||!visibleEnd)return true
  const d=new Date(t.planned_start)
  return d>=visibleStart&&d<visibleEnd
 }),[filtered,visibleStart,visibleEnd])

 const selected=tickets.find(t=>t.id===selectedId)||null
 const outsideWorkingHours=useMemo(()=>visibleTickets.filter(t=>{
  if(!t.planned_start)return false
  const startDate=new Date(t.planned_start)
  const endDate=t.planned_end?new Date(t.planned_end):startDate
  const startMinutes=startDate.getHours()*60+startDate.getMinutes()
  const endMinutes=endDate.getHours()*60+endDate.getMinutes()
  return startMinutes<7*60||endMinutes>19*60||endDate.getDate()!==startDate.getDate()
 }).length,[visibleTickets])
 const techName=(id:string|null|undefined)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const customerName=(id:string|null|undefined)=>customers.find(c=>c.id===id)?.name||'—'
 const techColor=(id:string|null|undefined)=>{
  if(!id)return '#6b7d90'
  const idx=Math.max(0,profiles.findIndex(p=>p.id===id))
  return palette[idx%palette.length]
 }

 const events=filtered.filter(t=>t.planned_start).map(t=>({
  id:t.id,
  title:t.ticket_number+' • '+t.subject+' • '+techName(t.assigned_to),
  start:t.planned_start!,
  end:t.planned_end||undefined,
  backgroundColor:techColor(t.assigned_to),
  borderColor:techColor(t.assigned_to),
  textColor:'#fff',
  extendedProps:{status:t.status,tech:t.assigned_to}
 }))

 const move=async(info:any)=>{
  const {error}=await supabase.from('tickets').update({planned_start:info.event.start?.toISOString(),planned_end:info.event.end?.toISOString()||null}).eq('id',info.event.id)
  if(error){info.revert();notify(error.message,'error')}
  else{notify('Planning mis à jour.');await qc.invalidateQueries({queryKey:['tickets']})}
 }

 const api=()=>calendarRef.current?.getApi()
 const changeView=(view:CalendarView)=>{setCalendarView(view);api()?.changeView(view)}
 const exportPlanning=()=>{
  const wb=XLSX.utils.book_new()
  addSheet(wb,'Planning filtré',visibleTickets.map(t=>({
   id:t.id,numero_ticket:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client:customerName(t.customer_id),description:t.description||'',
   categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,technicien:techName(t.assigned_to),technicien_id:t.assigned_to||'',
   date_arrivee:excelDate(t.arrival_at),debut_planifie:excelDate(t.planned_start),fin_planifie:excelDate(t.planned_end),incident_bloquant:t.is_blocking?'Oui':'Non',
   incident_parent:t.parent_incident||'',incident_general:t.general_incident_label||'',resolution:t.resolution_comment||'',date_cloture:excelDate(t.closed_at),
   cree_par:t.created_by||'',date_creation:excelDate(t.created_at),date_modification:excelDate(t.updated_at),customer_id:t.customer_id||'',customer_contact_id:t.customer_contact_id||''
  })))
  addSheet(wb,'Filtres',[{vue:calendarView,periode:title,technicien:tech?techName(tech):'Toute équipe',statut:status||'Tous',recherche:search||'',plage_horaire:fullDay?'00h-24h':'07h-19h',nombre_rendez_vous:visibleTickets.length}])
  downloadWorkbook(wb,'PlanningSecuritas_Planning_'+new Date().toISOString().slice(0,10)+'.xlsx')
  notify('Export Planning téléchargé.')
 }

 return <div className="page planning-page">
  <header className="page-head"><div><h1>Planning</h1><p>Vue Outlook : interventions côte à côte, couleur par technicien et détail immédiat.</p></div><button className="secondary page-primary-action" onClick={exportPlanning}><Download size={16}/> Export filtré</button></header>

  <section className="card planning-controls">
   <div className="planning-nav-row">
    <div className="planning-nav-buttons"><button className="ghost square-action" onClick={()=>api()?.prev()}><ChevronLeft size={17}/></button><button className="secondary" onClick={()=>api()?.today()}>Aujourd’hui</button><button className="ghost square-action" onClick={()=>api()?.next()}><ChevronRight size={17}/></button></div>
    <b className="planning-current-title">{title}</b>
    <div className="planning-actions-right">
     <div className="module-tabs planning-view-tabs">
      <button className={calendarView==='timeGridDay'?'primary':'ghost'} onClick={()=>changeView('timeGridDay')}>Jour</button>
      <button className={calendarView==='timeGridWeek'?'primary':'ghost'} onClick={()=>changeView('timeGridWeek')}>Semaine</button>
      <button className={calendarView==='dayGridMonth'?'primary':'ghost'} onClick={()=>changeView('dayGridMonth')}>Mois</button>
     </div>
     <button className={'planning-hours-toggle '+(fullDay?'active':'')} onClick={()=>setFullDay(v=>!v)} title={fullDay?'Revenir à 07h–19h':'Afficher 00h–24h'}>
      <Clock3 size={15}/><span>{fullDay?'24 h':'07h–19h'}</span>
     </button>
    </div>
   </div>
   <div className="planning-filter-row">
    <label className="wide-filter">Recherche<div className="input-with-icon"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ticket, site, demandeur, description…"/></div></label>
    {profile?.role==='manager'&&<label>Technicien<select value={tech} onChange={e=>setTech(e.target.value)}><option value="">Toute l’équipe</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>}
    <label>Statut<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous</option>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
    <span className="planning-result-count">{visibleTickets.length} rendez-vous{!fullDay&&outsideWorkingHours>0?' • '+outsideWorkingHours+' hors plage':''}</span>
   </div>
  </section>

  <div className={'calendar-viewport view-'+calendarView}>
   <div className="calendar-canvas"><div className="calendar-shell">
    <FullCalendar
     ref={calendarRef}
     plugins={[timeGridPlugin,dayGridPlugin,interactionPlugin]}
     locale={frLocale}
     initialView={calendarView}
     firstDay={1}
     allDaySlot={false}
     slotMinTime={fullDay?"00:00:00":"07:00:00"}
     slotMaxTime={fullDay?"24:00:00":"19:00:00"}
     nowIndicator
     height="auto"
     headerToolbar={false}
     editable
     selectable
     slotEventOverlap={false}
     eventOrderStrict
     events={events}
     eventDrop={move}
     eventResize={move}
     eventClick={info=>setSelectedId(info.event.id)}
     datesSet={arg=>{setTitle(arg.view.title);setVisibleStart(arg.start);setVisibleEnd(arg.end);setCalendarView(arg.view.type as CalendarView)}}
     dayHeaderFormat={{weekday:'short',day:'2-digit',month:'2-digit'}}
     eventTimeFormat={{hour:'2-digit',minute:'2-digit',hour12:false}}
    />
   </div></div>
  </div>

  <section className="card planning-list-card">
   <div className="module-filter-title"><ClipboardList size={16}/><b>Rendez-vous affichés</b><span>{visibleTickets.length}</span></div>
   <div className="planning-event-list">{visibleTickets.length===0&&<span className="muted">Aucun rendez-vous avec ces filtres.</span>}{visibleTickets.map(t=><button key={t.id} className="planning-event-row" onClick={()=>setSelectedId(t.id)}><span className="tech-color-dot" style={{background:techColor(t.assigned_to)}}/><div><b>{t.ticket_number} • {t.subject}</b><small>{customerName(t.customer_id)} • {techName(t.assigned_to)}</small></div><div><span className="badge">{t.status}</span><small>{excelDate(t.planned_start)}</small></div></button>)}</div>
  </section>

  {selected&&<DetailDrawer title={selected.ticket_number} subtitle="Rendez-vous / ticket" onClose={()=>setSelectedId(null)}>
   <h3 className="planning-ticket-title">{selected.subject}</h3>
   <div className="detail-summary-grid">
    <div><span>Technicien</span><b>{techName(selected.assigned_to)}</b></div><div><span>Client</span><b>{customerName(selected.customer_id)}</b></div>
    <div><span>Demandeur</span><b>{selected.requester||'—'}</b></div><div><span>Statut</span><b>{selected.status}</b></div>
    <div><span>Priorité</span><b>{selected.priority}</b></div><div><span>Catégorie</span><b>{selected.category}</b></div>
    <div><span>Type</span><b>{selected.intervention_type}</b></div><div><span>Bloquant</span><b>{selected.is_blocking?'Oui':'Non'}</b></div>
    <div><span>Début</span><b>{excelDate(selected.planned_start)||'—'}</b></div><div><span>Fin</span><b>{excelDate(selected.planned_end)||'—'}</b></div>
   </div>
   {selected.description&&<div className="detail-description">{selected.description}</div>}
   <h3 className="section-title"><History size={15}/> Historique ticket</h3>
   <div className="planning-history-list">{history.length===0&&<span className="muted">Aucun historique.</span>}{history.map((h:any)=><details className="compact-history" key={h.id}><summary><b>{h.action}</b><small>{excelDate(h.created_at)}</small></summary><pre>{JSON.stringify(h.details||{},null,2)}</pre></details>)}</div>
   <h3 className="section-title"><UserRound size={15}/> Commentaires</h3>
   <div className="planning-history-list">{comments.length===0&&<span className="muted">Aucun commentaire.</span>}{comments.map((c:any)=><div className="planning-comment-row" key={c.id}><div className="comment-row-head"><b>{c.author_name||'Utilisateur'}</b><span className={'badge '+(c.comment_scope==='notification'?'green':'')}>{c.comment_scope==='notification'?'Notification':'Interne'}</span></div><small>{excelDate(c.created_at)}</small><p>{c.body}</p></div>)}</div>
   <h3 className="section-title"><Package size={15}/> Matériel / stock</h3>
   <div className="planning-history-list">{movements.length===0&&<span className="muted">Aucun mouvement.</span>}{movements.map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return <details className="compact-history" key={m.id}><summary><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'} × {m.quantity}</b><small>{m.reason||m.movement_type}</small></summary><div className="detail-key-values"><div><span>Date</span><b>{excelDate(m.created_at)}</b></div><div><span>Stock</span><b>{m.old_total??'—'} → {m.new_total??'—'}</b></div><div><span>Bénéficiaire</span><b>{m.assignee||'—'}</b></div><div><span>Ticket</span><b>{m.ticket_number_snapshot||'—'}</b></div></div></details>})}</div>
  </DetailDrawer>}
 </div>
}
