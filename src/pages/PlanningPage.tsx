import { useEffect,useRef,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import { CalendarDays,ClipboardList,History,Package,UserRound,X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Customer,InventoryItem,Profile,Ticket } from '../lib/types'

export function PlanningPage(){
 const {profile}=useAuth()
 const qc=useQueryClient()
 const calendarRef=useRef<FullCalendar|null>(null)
 const [tech,setTech]=useState('')
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [mobile,setMobile]=useState(()=>window.innerWidth<=640)
 const [mobileView,setMobileView]=useState<'timeGridDay'|'timeGridThreeDay'|'timeGridWeek'>('timeGridDay')

 useEffect(()=>{
  const onResize=()=>setMobile(window.innerWidth<=640)
  window.addEventListener('resize',onResize)
  return()=>window.removeEventListener('resize',onResize)
 },[])

 const {data:tickets=[]}=useQuery({
  queryKey:['tickets'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('tickets').select('*').order('planned_start')
   if(error)throw error
   return data as Ticket[]
  }
 })

 const {data:profiles=[]}=useQuery({
  queryKey:['profiles'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('profiles').select('*').eq('active',true).order('display_name')
   if(error)throw error
   return data as Profile[]
  }
 })

 const {data:customers=[]}=useQuery({
  queryKey:['customers','planning'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('customers').select('*').eq('active',true).order('name')
   if(error)throw error
   return data as Customer[]
  }
 })

 const {data:history=[]}=useQuery({
  queryKey:['planning-history',selectedId],
  enabled:!!selectedId,
  queryFn:async()=>{
   const {data,error}=await supabase.from('ticket_history').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false})
   if(error)throw error
   return data||[]
  }
 })

 const {data:comments=[]}=useQuery({
  queryKey:['planning-comments',selectedId],
  enabled:!!selectedId,
  queryFn:async()=>{
   const {data,error}=await supabase.from('ticket_comments').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false})
   if(error)throw error
   return data||[]
  }
 })

 const {data:movements=[]}=useQuery({
  queryKey:['planning-stock',selectedId],
  enabled:!!selectedId,
  queryFn:async()=>{
   const {data,error}=await supabase.from('inventory_movements').select('*').eq('ticket_id',selectedId!).order('created_at',{ascending:false})
   if(error)throw error
   return data||[]
  }
 })

 const {data:items=[]}=useQuery({
  queryKey:['inventory','planning'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('inventory_items').select('*').order('model')
   if(error)throw error
   return data as InventoryItem[]
  }
 })

 const shown=tech?tickets.filter(t=>t.assigned_to===tech):tickets
 const selected=tickets.find(t=>t.id===selectedId)||null

 const events=shown.filter(t=>t.planned_start).map(t=>({
  id:t.id,
  title:t.ticket_number+' • '+t.subject,
  start:t.planned_start!,
  end:t.planned_end||undefined,
  extendedProps:{status:t.status,tech:t.assigned_to}
 }))

 const move=async(info:any)=>{
  const {error}=await supabase.from('tickets').update({
   planned_start:info.event.start?.toISOString(),
   planned_end:info.event.end?.toISOString()||null
  }).eq('id',info.event.id)
  if(error){
   info.revert()
   alert(error.message)
  }else{
   await qc.invalidateQueries({queryKey:['tickets']})
  }
 }

 const changeMobileView=(view:'timeGridDay'|'timeGridThreeDay'|'timeGridWeek')=>{
  setMobileView(view)
  calendarRef.current?.getApi().changeView(view)
 }

 const techName=(id:string|null|undefined)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const customerName=(id:string|null|undefined)=>customers.find(c=>c.id===id)?.name||'—'

 return <div className="page planning-page">
  <header className="page-head">
   <div>
    <h1>Planning</h1>
    <p>Clique sur un rendez-vous pour voir le ticket, le technicien, l’historique et le matériel utilisé.</p>
   </div>
   {profile?.role==='manager'&&
    <label className="tech-filter">Technicien
     <select value={tech} onChange={e=>setTech(e.target.value)}>
      <option value="">Toute l’équipe</option>
      {profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
     </select>
    </label>
   }
  </header>

  {mobile&&
   <div className="mobile-calendar-switch" aria-label="Vue du planning">
    <button className={mobileView==='timeGridDay'?'active':''} onClick={()=>changeMobileView('timeGridDay')}>Jour</button>
    <button className={mobileView==='timeGridThreeDay'?'active':''} onClick={()=>changeMobileView('timeGridThreeDay')}>3 jours</button>
    <button className={mobileView==='timeGridWeek'?'active':''} onClick={()=>changeMobileView('timeGridWeek')}>Semaine</button>
   </div>
  }

  <div className={selected?'planning-layout with-ticket':'planning-layout'}>
   <div className="calendar-shell">
    <FullCalendar
     ref={calendarRef}
     key={mobile?'mobile':'desktop'}
     plugins={[timeGridPlugin,dayGridPlugin,interactionPlugin]}
     locale={frLocale}
     initialView={mobile?'timeGridDay':'timeGridWeek'}
     firstDay={1}
     allDaySlot={false}
     slotMinTime="07:00:00"
     slotMaxTime="20:00:00"
     nowIndicator
     height="auto"
     expandRows={false}
     headerToolbar={mobile
      ?{left:'prev,next',center:'title',right:'today'}
      :{left:'prev,next today',center:'title',right:'timeGridDay,timeGridThreeDay,timeGridWeek,dayGridMonth'}
     }
     buttonText={{today:"Aujourd'hui",day:'Jour',week:'Semaine',month:'Mois'}}
     views={{timeGridThreeDay:{type:'timeGrid',duration:{days:3},buttonText:'3 jours'}}}
     editable
     selectable
     events={events}
     eventDrop={move}
     eventResize={move}
     eventClick={info=>setSelectedId(info.event.id)}
    />
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
     <div><span>Statut</span><b>{selected.status}</b></div>
     <div><span>Priorité</span><b>{selected.priority}</b></div>
     <div><span>Début</span><b>{selected.planned_start?new Date(selected.planned_start).toLocaleString('fr-FR'):'—'}</b></div>
     <div><span>Fin</span><b>{selected.planned_end?new Date(selected.planned_end).toLocaleString('fr-FR'):'—'}</b></div>
    </div>

    {selected.description&&<div className="detail-description">{selected.description}</div>}

    <h3 className="section-title"><History size={15}/> Historique ticket</h3>
    <div className="planning-history-list">
     {history.length===0&&<span className="muted">Aucun historique.</span>}
     {history.slice(0,10).map((h:any)=><div className="planning-history-row" key={h.id}><b>{h.action}</b><small>{new Date(h.created_at).toLocaleString('fr-FR')}</small></div>)}
    </div>

    <h3 className="section-title"><UserRound size={15}/> Commentaires</h3>
    <div className="planning-history-list">
     {comments.length===0&&<span className="muted">Aucun commentaire.</span>}
     {comments.slice(0,8).map((c:any)=><div className="planning-comment-row" key={c.id}><b>{c.author_name||'Utilisateur'}</b><small>{new Date(c.created_at).toLocaleString('fr-FR')}</small><p>{c.body}</p></div>)}
    </div>

    <h3 className="section-title"><Package size={15}/> Matériel / stock</h3>
    <div className="planning-history-list">
     {movements.length===0&&<span className="muted">Aucun mouvement de stock pour ce ticket.</span>}
     {movements.slice(0,10).map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return <div className="planning-stock-row" key={m.id}><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'} × {m.quantity}</b><small>{m.reason||m.movement_type} • {new Date(m.created_at).toLocaleString('fr-FR')}</small></div>})}
    </div>
   </aside>}
  </div>
 </div>
}
