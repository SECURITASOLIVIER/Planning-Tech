import { useMemo,useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download,FileClock,History as HistoryIcon,PackageSearch,ShieldCheck } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { presetRange } from '../lib/dateRange'
import { addSheet,downloadWorkbook,excelDate } from '../lib/excel'
import type { Customer,InventoryItem,Profile,Ticket } from '../lib/types'
import { DetailDrawer } from '../components/DetailDrawer'
import { notify } from '../lib/notify'

type HistoryKind='all'|'tickets'|'stock'|'actions'
type SelectedDetail={kind:'ticket'|'stock'|'action';row:any}|null

const prettyKey=(key:string)=>key.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase())

export function HistoryPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const initial=presetRange('month')
 const [from,setFrom]=useState(initial.from)
 const [to,setTo]=useState(initial.to)
 const [search,setSearch]=useState('')
 const [kind,setKind]=useState<HistoryKind>(manager?'all':'tickets')
 const [technician,setTechnician]=useState('')
 const [requester,setRequester]=useState('')
 const [customer,setCustomer]=useState('')
 const [selected,setSelected]=useState<SelectedDetail>(null)

 const until=useMemo(()=>new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString(),[to])

 const {data:tickets=[]}=useQuery({queryKey:['history-tickets'],queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('created_at',{ascending:false});if(error)throw error;return data as Ticket[]}})
 const {data:profiles=[]}=useQuery({queryKey:['history-profiles'],queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}})
 const {data:customers=[]}=useQuery({queryKey:['history-customers'],queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').order('name');if(error)throw error;return data as Customer[]}})
 const {data:items=[]}=useQuery({queryKey:['history-inventory'],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').order('model');if(error)throw error;return data as InventoryItem[]}})
 const {data:ticketHistory=[]}=useQuery({queryKey:['ticket-history-all',from,to],queryFn:async()=>{const {data,error}=await supabase.from('ticket_history').select('*').gte('created_at',from+'T00:00:00').lt('created_at',until).order('created_at',{ascending:false}).limit(3000);if(error)throw error;return data||[]}})
 const {data:movements=[]}=useQuery({queryKey:['stock-history-all',from,to],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('inventory_movements').select('*').gte('created_at',from+'T00:00:00').lt('created_at',until).order('created_at',{ascending:false}).limit(3000);if(error)throw error;return data||[]}})
 const {data:audit=[]}=useQuery({queryKey:['audit-events',from,to],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('audit_events').select('*').gte('created_at',from+'T00:00:00').lt('created_at',until).order('created_at',{ascending:false}).limit(3000);if(error)throw error;return data||[]}})
 const {data:kpi}=useQuery({queryKey:['history-kpi',from,to],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any}})

 const q=search.trim().toLowerCase()
 const actorName=(id:string|null)=>profiles.find(p=>p.id===id)?.display_name||id||'Système'
 const clientName=(id:string|null|undefined)=>customers.find(c=>c.id===id)?.name||'—'
 const requesters=useMemo(()=>[...new Set(tickets.map(t=>t.requester).filter((x):x is string=>!!x?.trim()))].sort((a,b)=>a.localeCompare(b,'fr')),[tickets])
 const ticketMatches=(t:Ticket|undefined)=>{
  if(!t)return !(technician||requester||customer)
  if(technician&&t.assigned_to!==technician)return false
  if(requester&&t.requester!==requester)return false
  if(customer&&t.customer_id!==customer)return false
  return true
 }
 const historyRows=useMemo(()=>ticketHistory.filter((h:any)=>{
  const t=tickets.find(x=>x.id===h.ticket_id),actor=profiles.find(x=>x.id===h.actor_id)
  if(!ticketMatches(t))return false
  return !q||(t?.ticket_number+' '+t?.subject+' '+(t?.requester||'')+' '+clientName(t?.customer_id)+' '+h.action+' '+actor?.display_name+' '+JSON.stringify(h.details||{})).toLowerCase().includes(q)
 }),[ticketHistory,tickets,profiles,q,technician,requester,customer,customers])
 const movementRows=useMemo(()=>movements.filter((m:any)=>{
  const item=items.find(x=>x.id===m.item_id)
  const t=tickets.find(x=>x.id===m.ticket_id)
  if((technician||requester||customer)&&!ticketMatches(t))return false
  return !q||((item?.manufacturer||'')+' '+(item?.model||'')+' '+(item?.reference||'')+' '+(m.ticket_number_snapshot||'')+' '+(t?.requester||'')+' '+clientName(t?.customer_id)+' '+(m.reason||'')+' '+m.movement_type+' '+actorName(m.actor_id)).toLowerCase().includes(q)
 }),[movements,items,q,technician,requester,customer,profiles,tickets,customers])
 const actionRows=useMemo(()=>audit.filter((a:any)=>{
  const targetTicket=(a.target_type==='tickets'||a.target_type==='ticket')?tickets.find(t=>t.id===a.target_id):undefined
  if(technician||requester||customer){
   if(targetTicket){if(!ticketMatches(targetTicket))return false}
   else{
    if(requester||customer)return false
    if(technician&&a.actor_id!==technician)return false
   }
  }
  return !q||(a.action+' '+a.target_type+' '+(a.target_id||'')+' '+(a.actor_name||'')+' '+(targetTicket?.ticket_number||'')+' '+(targetTicket?.requester||'')+' '+clientName(targetTicket?.customer_id)+' '+JSON.stringify(a.details||{})).toLowerCase().includes(q)
 }),[audit,q,technician,requester,customer,tickets,customers])

 const summary=kpi?.summary||{}
 const byTech=kpi?.by_technician||[]
 const filteredTicketIds=useMemo(()=>{
  const ids=new Set<string>()
  if(kind==='all'||kind==='tickets')historyRows.forEach((h:any)=>ids.add(h.ticket_id))
  if(kind==='all'||kind==='stock')movementRows.forEach((m:any)=>{if(m.ticket_id)ids.add(m.ticket_id)})
  if(manager&&(kind==='all'||kind==='actions'))actionRows.forEach((a:any)=>{if((a.target_type==='tickets'||a.target_type==='ticket')&&a.target_id)ids.add(a.target_id)})
  return ids
 },[kind,historyRows,movementRows,actionRows,manager])
 const detailedTickets=useMemo(()=>tickets.filter(t=>filteredTicketIds.has(t.id)),[tickets,filteredTicketIds])
 const resultCount=(kind==='all'||kind==='tickets'?historyRows.length:0)+(manager&&(kind==='all'||kind==='stock')?movementRows.length:0)+(manager&&(kind==='all'||kind==='actions')?actionRows.length:0)

 const exportExcel=()=>{
  const wb=XLSX.utils.book_new()
  if(kind==='all'||kind==='tickets')addSheet(wb,'Historique Tickets',historyRows.map((h:any)=>{
   const t=tickets.find(x=>x.id===h.ticket_id)
   return {id:h.id,date:excelDate(h.created_at),ticket_id:h.ticket_id,ticket:t?.ticket_number||'',titre:t?.subject||'',client_id:t?.customer_id||'',technicien_id:t?.assigned_to||'',technicien:actorName(t?.assigned_to||null),action:h.action,acteur_id:h.actor_id||'',acteur:actorName(h.actor_id),details:JSON.stringify(h.details||{}),...Object.fromEntries(Object.entries(h.details||{}).map(([k,v])=>['detail_'+k,typeof v==='object'?JSON.stringify(v):v]))}
  }))
  if(manager&&(kind==='all'||kind==='stock'))addSheet(wb,'Mouvements Stock',movementRows.map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return {id:m.id,date:excelDate(m.created_at),item_id:m.item_id,categorie:i?.category||'',constructeur:i?.manufacturer||'',modele:i?.model||'',reference:i?.reference||'',emplacement:i?.location||'',mouvement:m.movement_type,quantite:m.quantity,prix_unitaire_snapshot:Number(m.unit_price_snapshot||0),cout_total_snapshot:Number(m.total_cost_snapshot||0),ancien_total:m.old_total,nouveau_total:m.new_total,ticket_id:m.ticket_id||'',ticket:m.ticket_number_snapshot||'',allocation_id:m.allocation_id||'',beneficiaire:m.assignee||'',acteur_id:m.actor_id||'',acteur:actorName(m.actor_id),motif:m.reason||'',note:m.note||''}}))
  if(manager&&(kind==='all'||kind==='actions'))addSheet(wb,'Journal Actions',actionRows.map((a:any)=>({id:a.id,date:excelDate(a.created_at),acteur_id:a.actor_id||'',acteur:a.actor_name||actorName(a.actor_id),action:a.action,cible_type:a.target_type,cible_id:a.target_id||'',details:JSON.stringify(a.details||{})})))
  addSheet(wb,'Tickets détaillés',detailedTickets.map(t=>({
   id:t.id,numero_ticket:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client_id:t.customer_id||'',client:clientName(t.customer_id),
   customer_contact_id:t.customer_contact_id||'',description:t.description||'',categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,
   technicien_id:t.assigned_to||'',technicien:actorName(t.assigned_to),date_arrivee:excelDate(t.arrival_at),debut_planifie:excelDate(t.planned_start),
   fin_planifie:excelDate(t.planned_end),incident_bloquant:t.is_blocking?'Oui':'Non',incident_parent:t.parent_incident||'',
   incident_general:t.general_incident_label||'',commentaire_resolution:t.resolution_comment||'',cout_intervention:Number(t.intervention_cost||0),note_cout_intervention:t.intervention_cost_note||'',closed_by:t.closed_by||'',cloture_le:excelDate(t.closed_at),
   created_by:t.created_by||'',auteur_creation:actorName(t.created_by),cree_le:excelDate(t.created_at),modifie_le:excelDate(t.updated_at)
  })))
  if(manager){addSheet(wb,'KPI Synthese',[{du:from,au:to,ouverts:summary.backlog||0,nouveaux:summary.new_count||0,en_cours:summary.in_progress||0,en_attente:summary.waiting||0,bloquants:summary.blocking||0,clotures:summary.closed||0,crees:summary.created||0,taux_cloture:summary.closure_rate||0,cout_interventions:summary.intervention_cost_total||0,cout_materiel:summary.material_cost_total||0,cout_total:summary.total_cost||0,cout_moyen_intervention:summary.avg_cost_per_intervention||0}]);addSheet(wb,'KPI Techniciens',byTech)}
  addSheet(wb,'Filtres',[{du:from,au:to,type:kind,recherche:search||'',technicien:technician?actorName(technician):'Tous',demandeur:requester||'Tous',client:customer?clientName(customer):'Tous',resultats:resultCount,tickets_distincts:detailedTickets.length}])
  downloadWorkbook(wb,'PlanningSecuritas_Historique_'+from+'_'+to+'.xlsx');notify('Export Historique téléchargé.')
 }

 const preset=(p:'today'|'7d'|'month'|'year')=>{const r=presetRange(p);setFrom(r.from);setTo(r.to)}
 const detailEntries=selected?Object.entries(
  selected.kind==='ticket'?selected.row.details||{}:
  selected.kind==='action'?{date:excelDate(selected.row.created_at),acteur:selected.row.actor_name||actorName(selected.row.actor_id),action:selected.row.action,cible:selected.row.target_type,cible_id:selected.row.target_id||'—',...selected.row.details}:
  {date:excelDate(selected.row.created_at),mouvement:selected.row.movement_type,quantite:selected.row.quantity,ancien_total:selected.row.old_total,nouveau_total:selected.row.new_total,ticket:selected.row.ticket_number_snapshot||'—',beneficiaire:selected.row.assignee||'—',acteur:actorName(selected.row.actor_id),motif:selected.row.reason||'—',note:selected.row.note||'—'}
 ):[]

 return <div className="page history-page">
  <header className="page-head"><div><h1>Historique</h1><p>{manager?'Tickets, stock et journal d’actions.':'Historique de tes tickets uniquement.'} Le détail s’ouvre immédiatement.</p></div><button className="secondary page-primary-action" onClick={exportExcel}><Download size={16}/> Export filtré Excel</button></header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><HistoryIcon size={16}/><b>Période & filtres</b><span>{resultCount} résultat(s)</span></div>
   <div className="module-tabs history-presets history-view-tabs">{manager&&<button className={kind==='all'?'primary':'ghost'} onClick={()=>setKind('all')}>Tout</button>}<button className={kind==='tickets'?'primary':'ghost'} onClick={()=>setKind('tickets')}>{manager?'Tickets':'Mes tickets'}</button>{manager&&<button className={kind==='stock'?'primary':'ghost'} onClick={()=>setKind('stock')}>Stock</button>}{manager&&<button className={kind==='actions'?'primary':'ghost'} onClick={()=>setKind('actions')}>Actions</button>}</div>
   <div className="module-tabs history-presets"><button className="ghost" onClick={()=>preset('today')}>Aujourd’hui</button><button className="ghost" onClick={()=>preset('7d')}>7 jours</button><button className="ghost" onClick={()=>preset('month')}>Mois</button><button className="ghost" onClick={()=>preset('year')}>Année</button></div>
   <div className="module-filter-grid history-filters"><label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{manager&&<label>Technicien<select value={technician} onChange={e=>setTechnician(e.target.value)}><option value="">Tous</option>{profiles.map(p=><option value={p.id} key={p.id}>{p.display_name}{p.active?'':' (inactif)'}</option>)}</select></label>}<label>Demandeur<select value={requester} onChange={e=>setRequester(e.target.value)}><option value="">Tous</option>{requesters.map(x=><option value={x} key={x}>{x}</option>)}</select></label><label>Client<select value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Tous</option>{customers.map(c=><option value={c.id} key={c.id}>{c.name}{c.active?'':' (inactif)'}</option>)}</select></label><label className="wide-filter">Recherche<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ticket, demandeur, client, matériel, action, motif…"/></label></div>
  </section>

  {manager&&<section className="grid four kpi-grid clickable-kpis"><button className="kpi kpi-button" onClick={()=>setKind('tickets')}><b>{summary.backlog??0}</b><span>Tickets ouverts</span></button><button className="kpi kpi-button" onClick={()=>setKind('tickets')}><b>{summary.in_progress??0}</b><span>En cours</span></button><button className="kpi kpi-button" onClick={()=>setKind('tickets')}><b>{summary.waiting??0}</b><span>En attente</span></button><button className="kpi kpi-button good" onClick={()=>setKind('tickets')}><b>{summary.closed??0}</b><span>Clôturés période</span></button></section>}

  {selected&&<DetailDrawer title={selected.kind==='ticket'?'Événement ticket':selected.kind==='stock'?'Mouvement de stock':'Journal d’action'} subtitle="Détail complet" onClose={()=>setSelected(null)}>
   {selected.kind==='ticket'&&(()=>{const t=tickets.find(x=>x.id===selected.row.ticket_id);return <><div className="detail-summary-grid"><div><span>Ticket</span><b>{t?.ticket_number||selected.row.ticket_id}</b></div><div><span>Action</span><b>{selected.row.action}</b></div><div><span>Acteur</span><b>{actorName(selected.row.actor_id)}</b></div><div><span>Date action</span><b>{excelDate(selected.row.created_at)}</b></div><div><span>Demandeur</span><b>{t?.requester||'—'}</b></div><div><span>Client</span><b>{clientName(t?.customer_id)}</b></div><div><span>Technicien</span><b>{actorName(t?.assigned_to||null)}</b></div><div><span>Statut</span><b>{t?.status||'—'}</b></div><div><span>Priorité</span><b>{t?.priority||'—'}</b></div><div><span>Planifié</span><b>{excelDate(t?.planned_start)||'—'}</b></div></div>{t?.description&&<div className="detail-description">{t.description}</div>}</>})()}
   {selected.kind==='stock'&&(()=>{const i=items.find(x=>x.id===selected.row.item_id);return <div className="detail-summary-grid"><div><span>Matériel</span><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||selected.row.item_id}</b></div><div><span>Référence</span><b>{i?.reference||'—'}</b></div></div>})()}
   <div className="detail-key-values">{detailEntries.map(([key,value])=><div key={key}><span>{prettyKey(key)}</span><b>{typeof value==='object'?JSON.stringify(value):String(value??'—')}</b></div>)}</div>
  </DetailDrawer>}

  {manager&&kind==='all'&&<details className="card history-collapse"><summary>KPI par technicien <span>{byTech.length}</span></summary><div className="module-mobile-list force-visible">{byTech.map((t:any)=><article className="module-mobile-card clickable-row" key={t.id} onClick={()=>setTechnician(t.id)}><div className="module-mobile-head"><div><b>{t.name}</b><small>{t.total} ticket(s) sur la période</small></div><span className="badge">{t.open} ouverts</span></div><div className="module-mobile-meta"><div><span>En cours</span><b>{t.in_progress}</b></div><div><span>En attente</span><b>{t.waiting}</b></div><div><span>Clôturés</span><b>{t.closed}</b></div><div><span>Bloquants</span><b>{t.blocking}</b></div></div></article>)}</div></details>}

  {(kind==='all'||kind==='tickets')&&<details className="card history-collapse" open={kind==='tickets'}><summary><span><FileClock size={15}/> Historique tickets</span><b>{historyRows.length}</b></summary><div className="history-scroll-list">{historyRows.map((h:any)=>{const t=tickets.find(x=>x.id===h.ticket_id),actor=profiles.find(x=>x.id===h.actor_id);return <button className="history-line" key={h.id} onClick={()=>setSelected({kind:'ticket',row:h})}><div><b>{t?.ticket_number||'Ticket'} • {h.action}</b><small>{t?.subject||''}</small></div><div><span>{actor?.display_name||'Système'}</span><small>{excelDate(h.created_at)}</small></div></button>})}</div></details>}

  {manager&&(kind==='all'||kind==='stock')&&<details className="card history-collapse" open={kind==='stock'}><summary><span><PackageSearch size={15}/> Historique stock</span><b>{movementRows.length}</b></summary><div className="history-scroll-list">{movementRows.map((m:any)=>{const i=items.find(x=>x.id===m.item_id);return <button className="history-line" key={m.id} onClick={()=>setSelected({kind:'stock',row:m})}><div><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'} × {m.quantity}</b><small>{m.ticket_number_snapshot||'Sans ticket'} • {m.reason||m.movement_type}</small></div><div><span>{m.movement_type}</span><small>{excelDate(m.created_at)}</small></div></button>})}</div></details>}

  {manager&&(kind==='all'||kind==='actions')&&<details className="card history-collapse" open={kind==='actions'}><summary><span><ShieldCheck size={15}/> Journal des actions</span><b>{actionRows.length}</b></summary><div className="history-scroll-list">{actionRows.map((a:any)=><button className="history-line" key={a.id} onClick={()=>setSelected({kind:'action',row:a})}><div><b>{a.action}</b><small>{a.target_type} • {a.target_id||'—'}</small></div><div><span>{a.actor_name||actorName(a.actor_id)}</span><small>{excelDate(a.created_at)}</small></div></button>)}</div></details>}
 </div>
}
