import { useMemo,useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfMonth,format } from 'date-fns'
import { ChevronRight,Download,X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { exportManagerWorkbook } from '../lib/exportExcel'
import type { Customer,Profile,Ticket } from '../lib/types'

type Metric='created'|'closed'|'in_progress'|'blocking'|'backlog'|'stock'|null

export function DashboardPage(){
 const {profile}=useAuth()
 const from=format(startOfMonth(new Date()),'yyyy-MM-dd'),to=format(new Date(),'yyyy-MM-dd')
 const [metric,setMetric]=useState<Metric>(null)
 const [exportState,setExportState]=useState('')

 const {data}=useQuery({queryKey:['dashboard',from,to],queryFn:async()=>{
  const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any
 }})

 const {data:tickets=[]}=useQuery({
  queryKey:['dashboard-tickets'],
  queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('created_at',{ascending:false});if(error)throw error;return data as Ticket[]}
 })
 const {data:profiles=[]}=useQuery({
  queryKey:['dashboard-profiles'],
  queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}
 })
 const {data:clients=[]}=useQuery({
  queryKey:['dashboard-clients'],
  queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').order('name');if(error)throw error;return data as Customer[]}
 })
 const {data:inventory=[]}=useQuery({
  queryKey:['dashboard-inventory'],
  queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').order('model');if(error)throw error;return data||[]}
 })

 const s=data?.summary||{}
 const closedLabel='Clôturé'
 const inProgressLabel='En cours'
 const start=new Date(from+'T00:00:00').getTime()
 const end=new Date(new Date(to+'T00:00:00').getTime()+86400000).getTime()

 const detailTickets=useMemo(()=>{
  if(!metric||metric==='stock')return []
  return tickets.filter(t=>{
   const created=new Date(t.created_at).getTime()
   const closed=t.closed_at?new Date(t.closed_at).getTime():0
   if(metric==='created')return created>=start&&created<end
   if(metric==='closed')return closed>=start&&closed<end
   if(metric==='in_progress')return t.status===inProgressLabel
   if(metric==='blocking')return t.is_blocking&&t.status!==closedLabel
   if(metric==='backlog')return t.status!==closedLabel&&created<end
   return false
  })
 },[metric,tickets,start,end])

 const lowStock=useMemo(()=>inventory.filter((i:any)=>(i.quantity_total-i.quantity_reserved-i.quantity_assigned)<=i.stock_minimum),[inventory])
 const techName=(id:string|null)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const clientName=(id:string|null|undefined)=>clients.find(c=>c.id===id)?.name||'—'

 const runExport=async()=>{
  try{
   setExportState('Préparation de l’Excel…')
   await exportManagerWorkbook(from,to)
   setExportState('Export Excel téléchargé.')
  }catch(e:any){
   console.error(e)
   setExportState('Erreur export : '+(e?.message||'échec du téléchargement'))
  }
 }

 const metricTitle:Record<string,string>={
  created:'Tickets créés ce mois',closed:'Tickets clôturés',in_progress:'Tickets en cours',
  blocking:'Tickets bloquants',backlog:'Backlog',stock:'Stock faible / rupture'
 }

 return <div className="page dashboard-page">
  <header className="page-head">
   <div><h1>Bonjour {profile?.display_name}</h1><p>Vue opérationnelle. Clique sur un indicateur pour accéder directement aux données.</p></div>
   {profile?.role==='manager'&&<button className="secondary page-primary-action" onClick={()=>void runExport()}><Download size={16}/> Exporter Excel</button>}
  </header>

  {exportState&&<div className={'alert '+(exportState.startsWith('Erreur')?'error':'')}>{exportState}</div>}

  <section className="grid four kpi-grid clickable-kpis">
   <button className={'kpi kpi-button '+(metric==='created'?'selected':'')} onClick={()=>setMetric(metric==='created'?null:'created')}><b>{s.created??0}</b><span>Tickets créés ce mois</span><ChevronRight size={15}/></button>
   <button className={'kpi kpi-button good '+(metric==='closed'?'selected':'')} onClick={()=>setMetric(metric==='closed'?null:'closed')}><b>{s.closed??0}</b><span>Clôturés</span><ChevronRight size={15}/></button>
   <button className={'kpi kpi-button '+(metric==='in_progress'?'selected':'')} onClick={()=>setMetric(metric==='in_progress'?null:'in_progress')}><b>{s.in_progress??0}</b><span>En cours</span><ChevronRight size={15}/></button>
   <button className={'kpi kpi-button danger '+(metric==='blocking'?'selected':'')} onClick={()=>setMetric(metric==='blocking'?null:'blocking')}><b>{s.blocking??0}</b><span>Bloquants</span><ChevronRight size={15}/></button>
  </section>

  <section className="grid two">
   <button className={'card dashboard-detail-card '+(metric==='backlog'?'selected':'')} onClick={()=>setMetric(metric==='backlog'?null:'backlog')}><h3 className="section-title">Backlog</h3><p className="muted">Tickets encore ouverts</p><div className="kpi"><b>{s.backlog??0}</b><span>tickets</span></div><small>Voir les tickets</small></button>
   <button className={'card dashboard-detail-card '+(metric==='stock'?'selected':'')} onClick={()=>setMetric(metric==='stock'?null:'stock')}><h3 className="section-title">Stock</h3><p className="muted">Alertes inventaire actives</p><div className="kpi"><b>{data?.inventory?.low_stock??0}</b><span>stock faible / rupture</span></div><small>Voir les références</small></button>
  </section>

  {metric&&<section className="card inline-data-panel">
   <div className="inline-data-head"><div><small>Détail</small><h2>{metricTitle[metric]}</h2></div><button className="ghost small" onClick={()=>setMetric(null)}><X size={15}/></button></div>
   {metric==='stock'?<>
    <div className="table-wrap desktop-only"><table><thead><tr><th>Catégorie</th><th>Matériel</th><th>Référence</th><th>Total</th><th>Réservé</th><th>Attribué</th><th>Disponible</th><th>Stock mini</th><th>Emplacement</th></tr></thead><tbody>{lowStock.map((i:any)=><tr key={i.id}><td>{i.category}</td><td><b>{[i.manufacturer,i.model].filter(Boolean).join(' ')}</b></td><td>{i.reference||'—'}</td><td>{i.quantity_total}</td><td>{i.quantity_reserved}</td><td>{i.quantity_assigned}</td><td>{i.quantity_total-i.quantity_reserved-i.quantity_assigned}</td><td>{i.stock_minimum}</td><td>{i.location||'—'}</td></tr>)}</tbody></table></div>
    <div className="module-mobile-list">{lowStock.map((i:any)=><article className="module-mobile-card" key={i.id}><div className="module-mobile-head"><div><b>{[i.manufacturer,i.model].filter(Boolean).join(' ')}</b><small>{i.category} • {i.reference||'Sans référence'}</small></div><span className="badge red">{i.quantity_total-i.quantity_reserved-i.quantity_assigned} dispo.</span></div><div className="module-mobile-meta"><div><span>Total</span><b>{i.quantity_total}</b></div><div><span>Réservé</span><b>{i.quantity_reserved}</b></div><div><span>Attribué</span><b>{i.quantity_assigned}</b></div><div><span>Stock mini</span><b>{i.stock_minimum}</b></div></div></article>)}</div>
   </>:<>
    <div className="table-wrap desktop-only"><table><thead><tr><th>Ticket</th><th>Client</th><th>Statut</th><th>Priorité</th><th>Technicien</th><th>Créé</th><th>Planifié</th><th>Description</th></tr></thead><tbody>{detailTickets.map(t=><tr key={t.id}><td><b>{t.ticket_number}</b><br/><small>{t.subject}</small></td><td>{clientName(t.customer_id)}</td><td><span className="badge">{t.status}</span></td><td>{t.priority}</td><td>{techName(t.assigned_to)}</td><td>{new Date(t.created_at).toLocaleString('fr-FR')}</td><td>{t.planned_start?new Date(t.planned_start).toLocaleString('fr-FR'):'—'}</td><td>{t.description||'—'}</td></tr>)}</tbody></table></div>
    <div className="module-mobile-list">{detailTickets.map(t=><article className="module-mobile-card" key={t.id}><div className="module-mobile-head"><div><b>{t.ticket_number} • {t.subject}</b><small>{clientName(t.customer_id)}</small></div><span className="badge">{t.status}</span></div><div className="module-mobile-meta"><div><span>Technicien</span><b>{techName(t.assigned_to)}</b></div><div><span>Priorité</span><b>{t.priority}</b></div><div><span>Créé</span><b>{new Date(t.created_at).toLocaleDateString('fr-FR')}</b></div><div><span>Planifié</span><b>{t.planned_start?new Date(t.planned_start).toLocaleString('fr-FR'):'—'}</b></div></div>{t.description&&<div className="detail-description">{t.description}</div>}</article>)}</div>
   </>}
  </section>}
 </div>
}
