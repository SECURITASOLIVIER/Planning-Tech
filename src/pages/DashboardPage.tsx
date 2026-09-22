import { useMemo,useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfMonth,format } from 'date-fns'
import { ChevronRight,Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { exportManagerWorkbook } from '../lib/exportExcel'
import { notify } from '../lib/notify'
import { DetailDrawer } from '../components/DetailDrawer'
import type { Customer,InventoryItem,Profile,Ticket } from '../lib/types'

type Metric='created'|'closed'|'in_progress'|'blocking'|'backlog'|'stock'|null

export function DashboardPage(){
 const {profile}=useAuth()
 const from=format(startOfMonth(new Date()),'yyyy-MM-dd'),to=format(new Date(),'yyyy-MM-dd')
 const [metric,setMetric]=useState<Metric>(null)
 const [selectedTicket,setSelectedTicket]=useState<Ticket|null>(null)
 const [selectedItem,setSelectedItem]=useState<InventoryItem|null>(null)

 const {data}=useQuery({queryKey:['dashboard',from,to],queryFn:async()=>{const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any}})
 const {data:tickets=[]}=useQuery({queryKey:['dashboard-tickets'],queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('created_at',{ascending:false});if(error)throw error;return data as Ticket[]}})
 const {data:profiles=[]}=useQuery({queryKey:['dashboard-profiles'],queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}})
 const {data:clients=[]}=useQuery({queryKey:['dashboard-clients'],queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').order('name');if(error)throw error;return data as Customer[]}})
 const {data:inventory=[]}=useQuery({queryKey:['dashboard-inventory'],queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').order('model');if(error)throw error;return data as InventoryItem[]}})

 const s=data?.summary||{}
 const start=new Date(from+'T00:00:00').getTime()
 const end=new Date(new Date(to+'T00:00:00').getTime()+86400000).getTime()
 const techName=(id:string|null)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const clientName=(id:string|null|undefined)=>clients.find(c=>c.id===id)?.name||'—'

 const detailTickets=useMemo(()=>{
  if(!metric||metric==='stock')return []
  return tickets.filter(t=>{
   const created=new Date(t.created_at).getTime()
   const closed=t.closed_at?new Date(t.closed_at).getTime():0
   if(metric==='created')return created>=start&&created<end
   if(metric==='closed')return closed>=start&&closed<end
   if(metric==='in_progress')return t.status==='En cours'
   if(metric==='blocking')return t.is_blocking&&t.status!=='Clôturé'
   if(metric==='backlog')return t.status!=='Clôturé'&&created<end
   return false
  })
 },[metric,tickets,start,end])
 const lowStock=useMemo(()=>inventory.filter(i=>(i.quantity_total-i.quantity_reserved-i.quantity_assigned)<=i.stock_minimum),[inventory])

 const openMetric=(m:Metric)=>{setMetric(m);setSelectedTicket(null);setSelectedItem(null)}
 const runExport=async()=>{try{notify('Préparation de l’Excel…','info');await exportManagerWorkbook(from,to);notify('Export Excel téléchargé.')}catch(e:any){notify('Erreur export : '+(e?.message||'échec'),'error')}}

 const metricTitle:Record<string,string>={created:'Tickets créés ce mois',closed:'Tickets clôturés',in_progress:'Tickets en cours',blocking:'Tickets bloquants',backlog:'Backlog',stock:'Stock faible / rupture'}

 return <div className="page dashboard-page">
  <header className="page-head"><div><h1>Bonjour {profile?.display_name}</h1><p>Chaque indicateur ouvre la liste réelle qui compose le chiffre.</p></div>{profile?.role==='manager'&&<button className="secondary page-primary-action" onClick={()=>void runExport()}><Download size={16}/> Exporter Excel</button>}</header>

  <section className="grid four kpi-grid clickable-kpis">
   <button className="kpi kpi-button" onClick={()=>openMetric('created')}><b>{s.created??0}</b><span>Tickets créés ce mois</span><ChevronRight size={15}/></button>
   <button className="kpi kpi-button good" onClick={()=>openMetric('closed')}><b>{s.closed??0}</b><span>Clôturés</span><ChevronRight size={15}/></button>
   <button className="kpi kpi-button" onClick={()=>openMetric('in_progress')}><b>{s.in_progress??0}</b><span>En cours</span><ChevronRight size={15}/></button>
   <button className="kpi kpi-button danger" onClick={()=>openMetric('blocking')}><b>{s.blocking??0}</b><span>Bloquants</span><ChevronRight size={15}/></button>
  </section>

  <section className="grid two">
   <button className="card dashboard-detail-card" onClick={()=>openMetric('backlog')}><h3 className="section-title">Backlog</h3><p className="muted">Tickets encore ouverts</p><div className="kpi"><b>{s.backlog??0}</b><span>tickets</span></div><small>Consulter la liste</small></button>
   <button className="card dashboard-detail-card" onClick={()=>openMetric('stock')}><h3 className="section-title">Stock</h3><p className="muted">Alertes inventaire actives</p><div className="kpi"><b>{data?.inventory?.low_stock??0}</b><span>stock faible / rupture</span></div><small>Consulter les références</small></button>
  </section>

  {metric&&<DetailDrawer title={metricTitle[metric]} subtitle={metric==='stock'?lowStock.length+' référence(s)':detailTickets.length+' ticket(s)'} onClose={()=>setMetric(null)}>
   {metric==='stock'?<>
    {selectedItem&&<div className="drawer-selected-detail"><h3>{[selectedItem.manufacturer,selectedItem.model].filter(Boolean).join(' ')}</h3><div className="detail-summary-grid"><div><span>Catégorie</span><b>{selectedItem.category}</b></div><div><span>Référence</span><b>{selectedItem.reference||'—'}</b></div><div><span>Total</span><b>{selectedItem.quantity_total}</b></div><div><span>Disponible</span><b>{selectedItem.quantity_total-selectedItem.quantity_reserved-selectedItem.quantity_assigned}</b></div><div><span>Réservé</span><b>{selectedItem.quantity_reserved}</b></div><div><span>Attribué</span><b>{selectedItem.quantity_assigned}</b></div><div><span>Stock mini</span><b>{selectedItem.stock_minimum}</b></div><div><span>Emplacement</span><b>{selectedItem.location||'—'}</b></div></div>{selectedItem.description&&<div className="detail-description">{selectedItem.description}</div>}</div>}
    <div className="drawer-list">{lowStock.map(i=><button key={i.id} className={'drawer-list-row '+(selectedItem?.id===i.id?'selected':'')} onClick={()=>setSelectedItem(i)}><div><b>{[i.manufacturer,i.model].filter(Boolean).join(' ')}</b><small>{i.category} • {i.reference||'Sans référence'}</small></div><strong>{i.quantity_total-i.quantity_reserved-i.quantity_assigned} dispo.</strong></button>)}</div>
   </>:<>
    {selectedTicket&&<div className="drawer-selected-detail"><h3>{selectedTicket.ticket_number} • {selectedTicket.subject}</h3><div className="detail-summary-grid"><div><span>Client</span><b>{clientName(selectedTicket.customer_id)}</b></div><div><span>Technicien</span><b>{techName(selectedTicket.assigned_to)}</b></div><div><span>Statut</span><b>{selectedTicket.status}</b></div><div><span>Priorité</span><b>{selectedTicket.priority}</b></div><div><span>Catégorie</span><b>{selectedTicket.category}</b></div><div><span>Type</span><b>{selectedTicket.intervention_type}</b></div><div><span>Planifié</span><b>{selectedTicket.planned_start?new Date(selectedTicket.planned_start).toLocaleString('fr-FR'):'—'}</b></div><div><span>Bloquant</span><b>{selectedTicket.is_blocking?'Oui':'Non'}</b></div></div>{selectedTicket.description&&<div className="detail-description">{selectedTicket.description}</div>}</div>}
    <div className="drawer-list">{detailTickets.map(t=><button key={t.id} className={'drawer-list-row '+(selectedTicket?.id===t.id?'selected':'')} onClick={()=>setSelectedTicket(t)}><div><b>{t.ticket_number} • {t.subject}</b><small>{clientName(t.customer_id)} • {techName(t.assigned_to)}</small></div><span className="badge">{t.status}</span></button>)}</div>
   </>}
  </DetailDrawer>}
 </div>
}
