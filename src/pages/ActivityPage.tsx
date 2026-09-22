import { useMemo,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { BarChart3,Clock3,Download,Play,Square,TimerReset,UsersRound,Wrench } from 'lucide-react'
import { Line,LineChart,CartesianGrid,Legend,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { presetRange } from '../lib/dateRange'
import type { Profile,Ticket } from '../lib/types'

type WorkType='intervention'|'remote'|'onsite'|'travel'|'diagnostic'|'installation'|'maintenance'

const workLabels:Record<WorkType,string>={
 intervention:'Intervention',
 remote:'À distance',
 onsite:'Sur site',
 travel:'Déplacement',
 diagnostic:'Diagnostic',
 installation:'Installation',
 maintenance:'Maintenance'
}

const hours=(start:string,end?:string|null)=>{
 const ms=new Date(end||Date.now()).getTime()-new Date(start).getTime()
 return Math.max(0,ms/3600000)
}
const formatHours=(n:number)=>n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' h'

export function ActivityPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()
 const initial=presetRange('month')
 const [from,setFrom]=useState(initial.from)
 const [to,setTo]=useState(initial.to)
 const [tech,setTech]=useState('')
 const [workTicket,setWorkTicket]=useState('')
 const [workType,setWorkType]=useState<WorkType>('intervention')

 const {data:profiles=[]}=useQuery({
  queryKey:['profiles','activity'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('profiles').select('*').eq('active',true).order('display_name')
   if(error)throw error
   return data as Profile[]
  }
 })

 const {data:tickets=[]}=useQuery({
  queryKey:['tickets','activity'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('tickets').select('*').order('created_at',{ascending:false}).limit(500)
   if(error)throw error
   return data as Ticket[]
  }
 })

 const effectiveTech=manager?(tech||null):profile?.id||null

 const {data:kpi,isFetching}=useQuery({
  queryKey:['activity_kpi',from,to,effectiveTech],
  queryFn:async()=>{
   const {data,error}=await supabase.rpc('activity_kpi',{p_from:from,p_to:to,p_technician:effectiveTech})
   if(error)throw error
   return data as any
  }
 })

 const {data:presence=[]}=useQuery({
  queryKey:['presence',from,to,effectiveTech],
  queryFn:async()=>{
   let q=supabase.from('technician_presence').select('*').gte('started_at',from+'T00:00:00').lt('started_at',new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString()).order('started_at',{ascending:false})
   if(effectiveTech)q=q.eq('technician_id',effectiveTech)
   const {data,error}=await q
   if(error)throw error
   return data||[]
  }
 })

 const {data:worklogs=[]}=useQuery({
  queryKey:['worklogs',from,to,effectiveTech],
  queryFn:async()=>{
   let q=supabase.from('ticket_worklogs').select('*').gte('started_at',from+'T00:00:00').lt('started_at',new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString()).order('started_at',{ascending:false})
   if(effectiveTech)q=q.eq('technician_id',effectiveTech)
   const {data,error}=await q
   if(error)throw error
   return data||[]
  }
 })

 const {data:myOpenPresence}=useQuery({
  queryKey:['open-presence',profile?.id],
  enabled:!!profile?.id,
  queryFn:async()=>{
   const {data,error}=await supabase.from('technician_presence').select('*').eq('technician_id',profile!.id).is('ended_at',null).maybeSingle()
   if(error)throw error
   return data
  }
 })

 const {data:myOpenWork}=useQuery({
  queryKey:['open-work',profile?.id],
  enabled:!!profile?.id,
  queryFn:async()=>{
   const {data,error}=await supabase.from('ticket_worklogs').select('*').eq('technician_id',profile!.id).is('ended_at',null).maybeSingle()
   if(error)throw error
   return data
  }
 })

 const myTickets=useMemo(()=>manager?tickets:tickets.filter(t=>t.assigned_to===profile?.id),[tickets,manager,profile?.id])
 const openTicket=tickets.find(t=>t.id===myOpenWork?.ticket_id)
 const s=kpi?.summary||{}
 const technicians=kpi?.technicians||[]
 const ticketStats=kpi?.tickets||[]
 const clientStats=kpi?.clients||[]
 const daily=kpi?.daily||[]

 const refresh=async()=>Promise.all([
  qc.invalidateQueries({queryKey:['activity_kpi']}),
  qc.invalidateQueries({queryKey:['presence']}),
  qc.invalidateQueries({queryKey:['worklogs']}),
  qc.invalidateQueries({queryKey:['open-presence']}),
  qc.invalidateQueries({queryKey:['open-work']})
 ])

 const startPresence=async(type:'work'|'remote'|'onsite')=>{
  const note=prompt('Note de présence (optionnelle)')||null
  const {error}=await supabase.rpc('start_presence',{p_type:type,p_note:note})
  if(error)alert(error.message);else await refresh()
 }
 const stopPresence=async()=>{
  const note=prompt('Note de fin de présence (optionnelle)')||null
  const {error}=await supabase.rpc('stop_presence',{p_note:note})
  if(error)alert(error.message);else await refresh()
 }
 const startWork=async()=>{
  if(!workTicket){alert('Choisis un ticket');return}
  const note=prompt('Motif / action prévue (optionnel)')||null
  const {error}=await supabase.rpc('start_ticket_work',{p_ticket_id:workTicket,p_work_type:workType,p_note:note})
  if(error)alert(error.message);else await refresh()
 }
 const stopWork=async()=>{
  const note=prompt('Compte rendu court de fin d’intervention (optionnel)')||null
  const {error}=await supabase.rpc('stop_ticket_work',{p_note:note})
  if(error)alert(error.message);else await refresh()
 }

 const preset=(p:'today'|'7d'|'month'|'year')=>{const r=presetRange(p);setFrom(r.from);setTo(r.to)}

 const exportActivity=()=>{
  const wb=XLSX.utils.book_new()
  const add=(name:string,rows:any[])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name)
  add('Synthese',[{du:from,au:to,...s}])
  add('Techniciens',technicians)
  add('Clients',clientStats)
  add('Tickets',ticketStats)
  add('Presences',presence.map((p:any)=>({
   technicien:profiles.find(x=>x.id===p.technician_id)?.display_name||p.technician_id,
   debut:p.started_at,fin:p.ended_at||'En cours',type:p.presence_type,duree_heures:Number(hours(p.started_at,p.ended_at).toFixed(2)),note:p.note||''
  })))
  add('Interventions',worklogs.map((w:any)=>{
   const t=tickets.find(x=>x.id===w.ticket_id)
   return {ticket:t?.ticket_number||w.ticket_id,titre:t?.subject||'',technicien:profiles.find(x=>x.id===w.technician_id)?.display_name||w.technician_id,type:w.work_type,debut:w.started_at,fin:w.ended_at||'En cours',duree_heures:Number(hours(w.started_at,w.ended_at).toFixed(2)),note:w.note||''}
  }))
  XLSX.writeFile(wb,'Activite_'+from+'_'+to+'.xlsx')
 }

 return <div className="page activity-page">
  <header className="page-head">
   <div><h1>Activité & temps</h1><p>Présence, interventions, tickets et justificatifs d’activité.</p></div>
   {manager&&<button className="secondary page-primary-action" onClick={exportActivity}><Download size={16}/> Export activité</button>}
  </header>

  <section className="card activity-clock-card">
   <div className="activity-clock-block">
    <div><Clock3 size={18}/><b>Présence</b></div>
    {myOpenPresence?
     <><span className="live-badge">En cours depuis {new Date(myOpenPresence.started_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span><button className="danger" onClick={()=>void stopPresence()}><Square size={15}/> Fin présence</button></>
     :<div className="activity-start-buttons"><button className="primary" onClick={()=>void startPresence('work')}><Play size={15}/> Début présence</button><button className="ghost" onClick={()=>void startPresence('onsite')}>Sur site</button><button className="ghost" onClick={()=>void startPresence('remote')}>À distance</button></div>}
   </div>

   <div className="activity-clock-block">
    <div><Wrench size={18}/><b>Intervention</b></div>
    {myOpenWork?
     <><span className="live-badge">{openTicket?.ticket_number||'Ticket'} • {workLabels[myOpenWork.work_type as WorkType]||myOpenWork.work_type}</span><button className="danger" onClick={()=>void stopWork()}><Square size={15}/> Terminer</button></>
     :<div className="activity-work-start"><select value={workTicket} onChange={e=>setWorkTicket(e.target.value)}><option value="">Choisir un ticket…</option>{myTickets.map(t=><option key={t.id} value={t.id}>{t.ticket_number} • {t.subject}</option>)}</select><select value={workType} onChange={e=>setWorkType(e.target.value as WorkType)}>{Object.entries(workLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="primary" onClick={()=>void startWork()}><Play size={15}/> Démarrer</button></div>}
   </div>
  </section>

  <section className="card module-filter-card">
   <div className="module-filter-title"><BarChart3 size={16}/><b>Période & filtres</b>{isFetching&&<span>Actualisation…</span>}</div>
   <div className="module-tabs activity-presets"><button className="ghost" onClick={()=>preset('today')}>Aujourd’hui</button><button className="ghost" onClick={()=>preset('7d')}>7 jours</button><button className="ghost" onClick={()=>preset('month')}>Mois</button><button className="ghost" onClick={()=>preset('year')}>Année</button></div>
   <div className="module-filter-grid activity-filters"><label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{manager&&<label>Technicien<select value={tech} onChange={e=>setTech(e.target.value)}><option value="">Toute l’équipe</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>}</div>
  </section>

  <section className="grid four kpi-grid">
   <div className="kpi"><b>{formatHours(Number(s.presence_hours||0))}</b><span>Heures de présence</span></div>
   <div className="kpi good"><b>{formatHours(Number(s.intervention_hours||0))}</b><span>Heures intervention</span></div>
   <div className="kpi"><b>{s.interventions||0}</b><span>Interventions</span></div>
   <div className="kpi"><b>{s.tickets_worked||0}</b><span>Tickets travaillés</span></div>
   <div className="kpi"><b>{s.activity_rate||0}%</b><span>Taux activité / présence</span></div>
  </section>

  <section className="grid two chart-grid">
   <div className="card"><h3 className="section-title">Présence vs intervention</h3><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Line type="monotone" dataKey="presence_hours" name="Présence h"/><Line type="monotone" dataKey="intervention_hours" name="Intervention h"/></LineChart></ResponsiveContainer></div></div>
   <div className="card"><h3 className="section-title">Activité par client</h3><div className="client-kpi-list">{clientStats.length?clientStats.map((c:any)=><div className="client-kpi-row" key={c.client}><div><b>{c.client}</b><small>{c.tickets} ticket(s) • {c.interventions} intervention(s)</small></div><strong>{formatHours(Number(c.intervention_hours||0))}</strong></div>):<p className="muted">Aucune intervention sur la période.</p>}</div></div>
  </section>

  {manager&&<section className="card"><h3 className="section-title"><UsersRound size={15}/> Activité par technicien</h3><div className="table-wrap desktop-only"><table><thead><tr><th>Technicien</th><th>Présence</th><th>Intervention</th><th>Interventions</th><th>Tickets</th><th>Taux activité</th></tr></thead><tbody>{technicians.map((t:any)=><tr key={t.id}><td><b>{t.display_name}</b></td><td>{formatHours(Number(t.presence_hours||0))}</td><td>{formatHours(Number(t.intervention_hours||0))}</td><td>{t.interventions}</td><td>{t.tickets_worked}</td><td>{t.activity_rate}%</td></tr>)}</tbody></table></div><div className="module-mobile-list">{technicians.map((t:any)=><article className="module-mobile-card" key={t.id}><div className="module-mobile-head"><div><b>{t.display_name}</b><small>{t.tickets_worked} ticket(s)</small></div><span className="badge">{t.activity_rate}%</span></div><div className="module-mobile-meta"><div><span>Présence</span><b>{formatHours(Number(t.presence_hours||0))}</b></div><div><span>Intervention</span><b>{formatHours(Number(t.intervention_hours||0))}</b></div><div><span>Interventions</span><b>{t.interventions}</b></div><div><span>Tickets</span><b>{t.tickets_worked}</b></div></div></article>)}</div></section>}

  <section className="card"><h3 className="section-title"><TimerReset size={15}/> Activité par ticket</h3><div className="table-wrap desktop-only"><table><thead><tr><th>Ticket</th><th>Client</th><th>Technicien</th><th>Interventions</th><th>Temps</th></tr></thead><tbody>{ticketStats.map((t:any)=><tr key={t.id}><td><b>{t.ticket_number}</b><br/><small>{t.subject}</small></td><td>{t.client||'—'}</td><td>{t.technician||'—'}</td><td>{t.interventions}</td><td>{formatHours(Number(t.intervention_hours||0))}</td></tr>)}</tbody></table></div><div className="module-mobile-list">{ticketStats.map((t:any)=><article className="module-mobile-card" key={t.id}><div className="module-mobile-head"><div><b>{t.ticket_number} • {t.subject}</b><small>{t.client||'Sans client'}</small></div><strong>{formatHours(Number(t.intervention_hours||0))}</strong></div><div className="module-mobile-meta"><div><span>Technicien</span><b>{t.technician||'—'}</b></div><div><span>Interventions</span><b>{t.interventions}</b></div></div></article>)}</div></section>

  <section className="grid two">
   <div className="card"><h3 className="section-title">Historique présence</h3><div className="activity-log-list">{presence.map((p:any)=><div className="activity-log-row" key={p.id}><div><b>{profiles.find(x=>x.id===p.technician_id)?.display_name||'Technicien'}</b><small>{new Date(p.started_at).toLocaleString('fr-FR')} → {p.ended_at?new Date(p.ended_at).toLocaleString('fr-FR'):'En cours'}</small></div><strong>{formatHours(hours(p.started_at,p.ended_at))}</strong></div>)}</div>
   <div className="card"><h3 className="section-title">Historique interventions</h3><div className="activity-log-list">{worklogs.map((w:any)=>{const t=tickets.find(x=>x.id===w.ticket_id);return <div className="activity-log-row" key={w.id}><div><b>{t?.ticket_number||'Ticket'} • {workLabels[w.work_type as WorkType]||w.work_type}</b><small>{new Date(w.started_at).toLocaleString('fr-FR')} → {w.ended_at?new Date(w.ended_at).toLocaleString('fr-FR'):'En cours'}</small></div><strong>{formatHours(hours(w.started_at,w.ended_at))}</strong></div>})}</div>
  </section>
 </div>
}
