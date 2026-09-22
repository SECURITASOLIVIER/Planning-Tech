import { useMemo,useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { Download,X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { presetRange } from '../lib/dateRange'
import { addSheet,downloadWorkbook,excelDate } from '../lib/excel'
import type { Customer,Profile,Ticket } from '../lib/types'

type Metric='backlog'|'new_count'|'in_progress'|'waiting'|'closed'|'blocking'|'reopened'|null

export function KpiPage(){
 const initial=presetRange('month')
 const [from,setFrom]=useState(initial.from)
 const [to,setTo]=useState(initial.to)
 const [metric,setMetric]=useState<Metric>(null)
 const [tech,setTech]=useState('')

 const {data,isFetching}=useQuery({
  queryKey:['kpi',from,to],
  queryFn:async()=>{const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any}
 })
 const {data:tickets=[]}=useQuery({
  queryKey:['kpi-tickets'],
  queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('created_at',{ascending:false});if(error)throw error;return data as Ticket[]}
 })
 const {data:profiles=[]}=useQuery({
  queryKey:['kpi-profiles'],
  queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}
 })
 const {data:clients=[]}=useQuery({
  queryKey:['kpi-clients'],
  queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').order('name');if(error)throw error;return data as Customer[]}
 })
 const {data:config=[]}=useQuery({
  queryKey:['kpi-config'],
  queryFn:async()=>{const {data,error}=await supabase.from('config_values').select('*').eq('kind','status');if(error)throw error;return data||[]}
 })

 const statusLabel=(code:string,fallback:string)=>config.find((x:any)=>x.code===code)?.label||fallback
 const closedLabel=statusLabel('closed','Clôturé')
 const newLabel=statusLabel('new','Nouveau')
 const inProgressLabel=statusLabel('in_progress','En cours')
 const waitingLabel=statusLabel('waiting','En attente')

 const s=data?.summary||{}
 const timeline=data?.timeline||[]
 const byTech=data?.by_technician||[]
 const preset=(p:'today'|'7d'|'month'|'year')=>{const r=presetRange(p);setFrom(r.from);setTo(r.to)}
 const start=new Date(from+'T00:00:00').getTime()
 const end=new Date(new Date(to+'T00:00:00').getTime()+86400000).getTime()

 const detailTickets=useMemo(()=>tickets.filter(t=>{
  if(tech&&t.assigned_to!==tech)return false
  const created=new Date(t.created_at).getTime()
  const closed=t.closed_at?new Date(t.closed_at).getTime():0
  if(metric==='new_count')return t.status===newLabel
  if(metric==='in_progress')return t.status===inProgressLabel
  if(metric==='waiting')return t.status===waitingLabel
  if(metric==='closed')return closed>=start&&closed<end
  if(metric==='blocking')return t.is_blocking&&t.status!==closedLabel
  if(metric==='backlog')return t.status!==closedLabel&&created<end
  if(metric==='reopened')return false
  return (created>=start&&created<end)||(closed>=start&&closed<end)
 }),[tickets,tech,metric,newLabel,inProgressLabel,waitingLabel,closedLabel,start,end])

 const techName=(id:string|null)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const clientName=(id:string|null|undefined)=>clients.find(c=>c.id===id)?.name||'—'

 const exportExcel=()=>{
  const wb=XLSX.utils.book_new()
  addSheet(wb,'Synthese KPI',[{
   du:from,au:to,crees:s.created||0,nouveaux:s.new_count||0,ouverts:s.backlog||0,en_cours:s.in_progress||0,en_attente:s.waiting||0,
   bloquants:s.blocking||0,clotures:s.closed||0,reouverts:s.reopened||0,taux_cloture:s.closure_rate||0,
   delai_moyen_resolution_h:s.avg_resolution_hours||0,delai_prise_en_charge_h:s.avg_takeover_hours||0
  }])
  addSheet(wb,'KPI Techniciens',byTech)
  addSheet(wb,'Evolution',timeline)
  addSheet(wb,'Tickets détail',detailTickets.map(t=>({
   id:t.id,numero:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client:clientName(t.customer_id),description:t.description||'',
   categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,technicien:techName(t.assigned_to),
   technicien_id:t.assigned_to||'',arrivee:excelDate(t.arrival_at),debut_planifie:excelDate(t.planned_start),fin_planifie:excelDate(t.planned_end),
   bloquant:t.is_blocking?'Oui':'Non',incident_parent:t.parent_incident||'',incident_general:t.general_incident_label||'',
   resolution:t.resolution_comment||'',cloture:excelDate(t.closed_at),cree_le:excelDate(t.created_at),modifie_le:excelDate(t.updated_at)
  })))
  addSheet(wb,'Filtres',[{du:from,au:to,indicateur:metric||'Tous',technicien:tech?techName(tech):'Tous',tickets_detail:detailTickets.length}])
  downloadWorkbook(wb,'PlanningSecuritas_KPI_'+from+'_'+to+'.xlsx')
 }

 const metricTitle:Record<string,string>={
  backlog:'Tickets ouverts',new_count:'Nouveaux',in_progress:'En cours',waiting:'En attente',closed:'Clôturés',
  blocking:'Bloquants',reopened:'Réouverts'
 }

 return <div className="page kpi-page">
  <header className="page-head">
   <div><h1>KPI Tickets & Techniciens</h1><p>Clique sur un KPI ou un technicien pour afficher les tickets concernés.</p></div>
   <div className="actions">
    <div className="module-tabs"><button className="ghost" onClick={()=>preset('today')}>Aujourd’hui</button><button className="ghost" onClick={()=>preset('7d')}>7 jours</button><button className="ghost" onClick={()=>preset('month')}>Mois</button><button className="ghost" onClick={()=>preset('year')}>Année</button></div>
    <button className="secondary page-primary-action" onClick={exportExcel}><Download size={16}/> Export Excel</button>
   </div>
  </header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><b>Période & technicien</b>{isFetching&&<span>Actualisation…</span>}</div>
   <div className="module-filter-grid">
    <label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label>Technicien<select value={tech} onChange={e=>setTech(e.target.value)}><option value="">Tous</option>{profiles.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
   </div>
  </section>

  <section className="grid four kpi-grid clickable-kpis">
   <button className={'kpi kpi-button '+(metric==='backlog'?'selected':'')} onClick={()=>setMetric(metric==='backlog'?null:'backlog')}><b>{s.backlog??0}</b><span>Tickets ouverts</span></button>
   <button className={'kpi kpi-button '+(metric==='new_count'?'selected':'')} onClick={()=>setMetric(metric==='new_count'?null:'new_count')}><b>{s.new_count??0}</b><span>Nouveaux</span></button>
   <button className={'kpi kpi-button '+(metric==='in_progress'?'selected':'')} onClick={()=>setMetric(metric==='in_progress'?null:'in_progress')}><b>{s.in_progress??0}</b><span>En cours</span></button>
   <button className={'kpi kpi-button '+(metric==='waiting'?'selected':'')} onClick={()=>setMetric(metric==='waiting'?null:'waiting')}><b>{s.waiting??0}</b><span>En attente</span></button>
   <button className={'kpi kpi-button good '+(metric==='closed'?'selected':'')} onClick={()=>setMetric(metric==='closed'?null:'closed')}><b>{s.closed??0}</b><span>Clôturés période</span></button>
   <button className={'kpi kpi-button danger '+(metric==='blocking'?'selected':'')} onClick={()=>setMetric(metric==='blocking'?null:'blocking')}><b>{s.blocking??0}</b><span>Bloquants</span></button>
   <button className={'kpi kpi-button '+(metric==='reopened'?'selected':'')} onClick={()=>setMetric(metric==='reopened'?null:'reopened')}><b>{s.reopened??0}</b><span>Réouverts</span></button>
   <div className="kpi"><b>{s.closure_rate??0}%</b><span>Taux de clôture</span></div>
  </section>

  {(metric||tech)&&<section className="card inline-data-panel">
   <div className="inline-data-head"><div><small>Données accessibles</small><h2>{metric?metricTitle[metric]:'Tickets du technicien'}{tech?' • '+techName(tech):''}</h2></div><button className="ghost small" onClick={()=>{setMetric(null);setTech('')}}><X size={15}/></button></div>
   {metric==='reopened'?<div className="alert">Le compteur des réouvertures provient de l’historique. Consulte l’onglet Historique pour voir chaque réouverture.</div>:<>
    <div className="table-wrap desktop-only"><table><thead><tr><th>Ticket</th><th>Client</th><th>Statut</th><th>Priorité</th><th>Technicien</th><th>Planifié</th><th>Description</th></tr></thead><tbody>{detailTickets.map(t=><tr key={t.id}><td><b>{t.ticket_number}</b><br/><small>{t.subject}</small></td><td>{clientName(t.customer_id)}</td><td><span className="badge">{t.status}</span></td><td>{t.priority}</td><td>{techName(t.assigned_to)}</td><td>{excelDate(t.planned_start)||'—'}</td><td>{t.description||'—'}</td></tr>)}</tbody></table></div>
    <div className="module-mobile-list">{detailTickets.map(t=><article className="module-mobile-card" key={t.id}><div className="module-mobile-head"><div><b>{t.ticket_number} • {t.subject}</b><small>{clientName(t.customer_id)}</small></div><span className="badge">{t.status}</span></div><div className="module-mobile-meta"><div><span>Technicien</span><b>{techName(t.assigned_to)}</b></div><div><span>Priorité</span><b>{t.priority}</b></div><div><span>Planifié</span><b>{excelDate(t.planned_start)||'—'}</b></div><div><span>Bloquant</span><b>{t.is_blocking?'Oui':'Non'}</b></div></div>{t.description&&<div className="detail-description">{t.description}</div>}</article>)}</div>
   </>}
  </section>}

  <section className="grid two chart-grid">
   <div className="card"><h3 className="section-title">Créés / clôturés dans le temps</h3><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="period"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="created" name="Créés"/><Line type="monotone" dataKey="closed" name="Clôturés"/></LineChart></ResponsiveContainer></div></div>
   <div className="card"><h3 className="section-title">Charge par technicien</h3><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={byTech} onClick={(e:any)=>{const id=e?.activePayload?.[0]?.payload?.id;if(id)setTech(id)}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="open" name="Ouverts"/><Bar dataKey="in_progress" name="En cours"/><Bar dataKey="closed" name="Clôturés"/></BarChart></ResponsiveContainer></div></div>
  </section>

  <section className="card">
   <h3 className="section-title">KPI par technicien</h3>
   <div className="table-wrap desktop-only"><table><thead><tr><th>Technicien</th><th>Ouverts</th><th>Nouveaux</th><th>En cours</th><th>En attente</th><th>Clôturés</th><th>Bloquants</th></tr></thead><tbody>{byTech.map((t:any)=><tr className="clickable-row" key={t.id} onClick={()=>setTech(t.id)}><td><b>{t.name}</b></td><td>{t.open}</td><td>{t.new_count}</td><td>{t.in_progress}</td><td>{t.waiting}</td><td>{t.closed}</td><td>{t.blocking}</td></tr>)}</tbody></table></div>
   <div className="module-mobile-list">{byTech.map((t:any)=><article className="module-mobile-card clickable-row" key={t.id} onClick={()=>setTech(t.id)}><div className="module-mobile-head"><div><b>{t.name}</b><small>{t.total} ticket(s) créés sur la période</small></div><span className="badge">{t.open} ouverts</span></div><div className="module-mobile-meta"><div><span>Nouveaux</span><b>{t.new_count}</b></div><div><span>En cours</span><b>{t.in_progress}</b></div><div><span>En attente</span><b>{t.waiting}</b></div><div><span>Clôturés</span><b>{t.closed}</b></div></div></article>)}</div>
  </section>
 </div>
}
