import { useMemo,useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download,FileClock,History as HistoryIcon,PackageSearch } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { presetRange } from '../lib/dateRange'
import type { InventoryItem,Profile,Ticket } from '../lib/types'

export function HistoryPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const initial=presetRange('month')
 const [from,setFrom]=useState(initial.from)
 const [to,setTo]=useState(initial.to)
 const [search,setSearch]=useState('')

 const until=useMemo(()=>new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString(),[to])

 const {data:tickets=[]}=useQuery({
  queryKey:['history-tickets'],
  queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('created_at',{ascending:false});if(error)throw error;return data as Ticket[]}
 })
 const {data:profiles=[]}=useQuery({
  queryKey:['history-profiles'],
  queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}
 })
 const {data:items=[]}=useQuery({
  queryKey:['history-inventory'],
  queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').order('model');if(error)throw error;return data as InventoryItem[]}
 })
 const {data:ticketHistory=[]}=useQuery({
  queryKey:['ticket-history-all',from,to],
  queryFn:async()=>{
   const {data,error}=await supabase.from('ticket_history').select('*').gte('created_at',from+'T00:00:00').lt('created_at',until).order('created_at',{ascending:false}).limit(1500)
   if(error)throw error
   return data||[]
  }
 })
 const {data:movements=[]}=useQuery({
  queryKey:['stock-history-all',from,to],
  queryFn:async()=>{
   const {data,error}=await supabase.from('inventory_movements').select('*').gte('created_at',from+'T00:00:00').lt('created_at',until).order('created_at',{ascending:false}).limit(1500)
   if(error)throw error
   return data||[]
  }
 })
 const {data:kpi}=useQuery({
  queryKey:['history-kpi',from,to],
  enabled:manager,
  queryFn:async()=>{const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any}
 })

 const q=search.trim().toLowerCase()
 const historyRows=useMemo(()=>ticketHistory.filter((h:any)=>{
  const t=tickets.find(x=>x.id===h.ticket_id)
  const actor=profiles.find(x=>x.id===h.actor_id)
  const txt=(t?.ticket_number+' '+t?.subject+' '+h.action+' '+actor?.display_name+' '+JSON.stringify(h.details||{})).toLowerCase()
  return !q||txt.includes(q)
 }),[ticketHistory,tickets,profiles,q])

 const movementRows=useMemo(()=>movements.filter((m:any)=>{
  const item=items.find(x=>x.id===m.item_id)
  const txt=((item?.manufacturer||'')+' '+(item?.model||'')+' '+(m.ticket_number_snapshot||'')+' '+(m.reason||'')+' '+m.movement_type).toLowerCase()
  return !q||txt.includes(q)
 }),[movements,items,q])

 const summary=kpi?.summary||{}
 const byTech=kpi?.by_technician||[]

 const exportExcel=()=>{
  const wb=XLSX.utils.book_new()
  const add=(name:string,rows:any[])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name.slice(0,31))
  add('Historique Tickets',historyRows.map((h:any)=>{
   const t=tickets.find(x=>x.id===h.ticket_id),actor=profiles.find(x=>x.id===h.actor_id)
   return {date:h.created_at,ticket:t?.ticket_number||h.ticket_id,titre:t?.subject||'',action:h.action,acteur:actor?.display_name||h.actor_id||'Système',details:JSON.stringify(h.details||{})}
  }))
  add('Mouvements Stock',movementRows.map((m:any)=>{
   const i=items.find(x=>x.id===m.item_id),actor=profiles.find(x=>x.id===m.actor_id)
   return {date:m.created_at,materiel:[i?.manufacturer,i?.model].filter(Boolean).join(' '),reference:i?.reference||'',mouvement:m.movement_type,quantite:m.quantity,ticket:m.ticket_number_snapshot||'',motif:m.reason||'',beneficiaire:m.assignee||'',acteur:actor?.display_name||m.actor_id||''}
  }))
  if(manager){
   add('KPI Synthese',[{du:from,au:to,ouverts:summary.backlog||0,nouveaux:summary.new_count||0,en_cours:summary.in_progress||0,en_attente:summary.waiting||0,bloquants:summary.blocking||0,clotures:summary.closed||0,crees:summary.created||0,taux_cloture:summary.closure_rate||0}])
   add('KPI Techniciens',byTech)
  }
  XLSX.writeFile(wb,'PlanningSecuritas_Historique_'+from+'_'+to+'.xlsx')
 }

 const preset=(p:'today'|'7d'|'month'|'year')=>{const r=presetRange(p);setFrom(r.from);setTo(r.to)}

 return <div className="page history-page">
  <header className="page-head">
   <div><h1>Historique</h1><p>Historique des tickets et mouvements de stock sur la période.</p></div>
   {manager&&<button className="secondary page-primary-action" onClick={exportExcel}><Download size={16}/> Export Excel</button>}
  </header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><HistoryIcon size={16}/><b>Période & recherche</b><span>{historyRows.length+movementRows.length} ligne(s)</span></div>
   <div className="module-tabs history-presets"><button className="ghost" onClick={()=>preset('today')}>Aujourd’hui</button><button className="ghost" onClick={()=>preset('7d')}>7 jours</button><button className="ghost" onClick={()=>preset('month')}>Mois</button><button className="ghost" onClick={()=>preset('year')}>Année</button></div>
   <div className="module-filter-grid history-filters">
    <label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label className="wide-filter">Recherche<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ticket, matériel, action, motif…"/></label>
   </div>
  </section>

  {manager&&<section className="grid four kpi-grid">
   <div className="kpi"><b>{summary.backlog??0}</b><span>Tickets ouverts</span></div>
   <div className="kpi"><b>{summary.in_progress??0}</b><span>En cours</span></div>
   <div className="kpi"><b>{summary.waiting??0}</b><span>En attente</span></div>
   <div className="kpi good"><b>{summary.closed??0}</b><span>Clôturés période</span></div>
  </section>}

  {manager&&<section className="card"><h3 className="section-title">KPI par technicien</h3><div className="table-wrap desktop-only"><table><thead><tr><th>Technicien</th><th>Ouverts</th><th>Nouveaux</th><th>En cours</th><th>En attente</th><th>Clôturés</th><th>Bloquants</th></tr></thead><tbody>{byTech.map((t:any)=><tr key={t.id}><td><b>{t.name}</b></td><td>{t.open}</td><td>{t.new_count}</td><td>{t.in_progress}</td><td>{t.waiting}</td><td>{t.closed}</td><td>{t.blocking}</td></tr>)}</tbody></table></div><div className="module-mobile-list">{byTech.map((t:any)=><article className="module-mobile-card" key={t.id}><div className="module-mobile-head"><div><b>{t.name}</b><small>{t.total} ticket(s) créés sur la période</small></div><span className="badge">{t.open} ouverts</span></div><div className="module-mobile-meta"><div><span>En cours</span><b>{t.in_progress}</b></div><div><span>En attente</span><b>{t.waiting}</b></div><div><span>Clôturés</span><b>{t.closed}</b></div><div><span>Bloquants</span><b>{t.blocking}</b></div></div></article>)}</div></section>}

  <section className="card">
   <h3 className="section-title"><FileClock size={15}/> Historique tickets</h3>
   <div className="table-wrap desktop-only"><table><thead><tr><th>Date</th><th>Ticket</th><th>Action</th><th>Acteur</th><th>Détails</th></tr></thead><tbody>{historyRows.map((h:any)=>{const t=tickets.find(x=>x.id===h.ticket_id),actor=profiles.find(x=>x.id===h.actor_id);return <tr key={h.id}><td>{new Date(h.created_at).toLocaleString('fr-FR')}</td><td><b>{t?.ticket_number||'Ticket'}</b><br/><small>{t?.subject||''}</small></td><td><span className="badge">{h.action}</span></td><td>{actor?.display_name||'Système'}</td><td><small>{JSON.stringify(h.details||{})}</small></td></tr>})}</tbody></table></div>
   <div className="module-mobile-list">{historyRows.map((h:any)=>{const t=tickets.find(x=>x.id===h.ticket_id),actor=profiles.find(x=>x.id===h.actor_id);return <article className="module-mobile-card" key={h.id}><div className="module-mobile-head"><div><b>{t?.ticket_number||'Ticket'} • {h.action}</b><small>{new Date(h.created_at).toLocaleString('fr-FR')}</small></div><span className="badge">{actor?.display_name||'Système'}</span></div><div className="detail-description">{JSON.stringify(h.details||{})}</div></article>})}</div>
  </section>

  <section className="card">
   <h3 className="section-title"><PackageSearch size={15}/> Historique stock</h3>
   <div className="table-wrap desktop-only"><table><thead><tr><th>Date</th><th>Matériel</th><th>Mouvement</th><th>Qté</th><th>Ticket</th><th>Motif</th></tr></thead><tbody>{movementRows.map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('fr-FR')}</td><td><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'}</b></td><td><span className="badge">{m.movement_type}</span></td><td>{m.quantity}</td><td>{m.ticket_number_snapshot||'—'}</td><td>{m.reason||'—'}</td></tr>})}</tbody></table></div>
   <div className="module-mobile-list">{movementRows.map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return <article className="module-mobile-card" key={m.id}><div className="module-mobile-head"><div><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'}</b><small>{new Date(m.created_at).toLocaleString('fr-FR')} • {m.ticket_number_snapshot||'Sans ticket'}</small></div><span className="badge">× {m.quantity}</span></div><div className="detail-description"><b>Motif :</b> {m.reason||'—'}</div></article>})}</div>
  </section>
 </div>
}
