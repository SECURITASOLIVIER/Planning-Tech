import { FormEvent,useEffect,useMemo,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { CheckCircle2,Download,History,MessageSquarePlus,Package,Plus,RotateCcw,Save,Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/notify'
import { useAuth } from '../auth/AuthProvider'
import { addSheet,downloadWorkbook,excelDate } from '../lib/excel'
import { DetailDrawer } from '../components/DetailDrawer'
import type { Customer,Profile,Ticket } from '../lib/types'

type DateField='created_at'|'arrival_at'|'planned_start'|'closed_at'
const emptyTicket=():Partial<Ticket>=>({subject:'',requester:'',description:'',category:'',intervention_type:'',status:'',priority:'',assigned_to:null,arrival_at:new Date().toISOString(),planned_start:null,planned_end:null,is_blocking:false,parent_incident:null,general_incident_label:null,customer_id:null,customer_contact_id:null})

export function TicketsPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()
 const [selected,setSelected]=useState<Partial<Ticket>|null>(null)
 const [search,setSearch]=useState('')
 const [from,setFrom]=useState('')
 const [to,setTo]=useState('')
 const [dateField,setDateField]=useState<DateField>('created_at')
 const [technician,setTechnician]=useState('')
 const [requester,setRequester]=useState('')
 const [customer,setCustomer]=useState('')
 const [statusFilter,setStatusFilter]=useState('')
 const [priorityFilter,setPriorityFilter]=useState('')

 const {data:tickets=[]}=useQuery({queryKey:['tickets'],queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('arrival_at',{ascending:false});if(error)throw error;return data as Ticket[]}})
 const {data:profiles=[]}=useQuery({queryKey:['profiles','tickets'],queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}})
 const {data:config=[]}=useQuery({queryKey:['config'],queryFn:async()=>{const {data,error}=await supabase.from('config_values').select('*').eq('active',true).order('sort_order');if(error)throw error;return data||[]}})
 const {data:customers=[]}=useQuery({queryKey:['customers','tickets'],queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').order('name');if(error)throw error;return data as Customer[]}})
 const {data:comments=[]}=useQuery({queryKey:['comments',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_comments').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:history=[]}=useQuery({queryKey:['ticket-history-detail',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_history').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:materials=[]}=useQuery({queryKey:['ticket-materials-detail',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_materials').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:movements=[]}=useQuery({queryKey:['ticket-stock-detail',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('inventory_movements').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})

 const cfg=(kind:string)=>config.filter((x:any)=>x.kind===kind)
 const defaultLabel=(kind:string,code:string)=>cfg(kind).find((x:any)=>x.code===code)?.label||''
 const techName=(id:string|null|undefined)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const clientName=(id:string|null|undefined)=>customers.find(c=>c.id===id)?.name||'—'
 const requesters=useMemo(()=>[...new Set(tickets.map(t=>t.requester).filter((x):x is string=>!!x?.trim()))].sort((a,b)=>a.localeCompare(b,'fr')),[tickets])

 const rows=useMemo(()=>tickets.filter(t=>{
  const q=search.trim().toLowerCase()
  if(q&&!((t.ticket_number+' '+t.subject+' '+(t.requester||'')+' '+(t.description||'')+' '+clientName(t.customer_id)+' '+techName(t.assigned_to)).toLowerCase().includes(q)))return false
  if(technician&&t.assigned_to!==technician)return false
  if(requester&&t.requester!==requester)return false
  if(customer&&t.customer_id!==customer)return false
  if(statusFilter&&t.status!==statusFilter)return false
  if(priorityFilter&&t.priority!==priorityFilter)return false
  if(from||to){
   const raw=t[dateField]
   if(!raw)return false
   const ts=new Date(raw).getTime()
   if(from&&ts<new Date(from+'T00:00:00').getTime())return false
   if(to&&ts>=new Date(new Date(to+'T00:00:00').getTime()+86400000).getTime())return false
  }
  return true
 }),[tickets,search,technician,requester,customer,statusFilter,priorityFilter,from,to,dateField,profiles,customers])

 useEffect(()=>{if(selected&&!selected.id){setSelected(s=>({...s,status:s?.status||defaultLabel('status','new'),priority:s?.priority||defaultLabel('priority','normal'),category:s?.category||cfg('category')[0]?.label||'',intervention_type:s?.intervention_type||cfg('type')[0]?.label||''}))}},[config])

 const clearFilters=()=>{setSearch('');setFrom('');setTo('');setTechnician('');setRequester('');setCustomer('');setStatusFilter('');setPriorityFilter('');setDateField('created_at')}

 const save=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(!selected)return
  const fd=new FormData(e.currentTarget)
  const row:any={
   subject:String(fd.get('subject')),requester:String(fd.get('requester')||'')||null,description:String(fd.get('description')||'')||null,
   category:String(fd.get('category')),intervention_type:String(fd.get('type')),status:String(fd.get('status')),priority:String(fd.get('priority')),
   assigned_to:manager?(String(fd.get('assigned_to')||'')||null):(profile?.id||null),customer_id:String(fd.get('customer_id')||'')||null,
   is_blocking:fd.get('blocking')==='on',parent_incident:String(fd.get('parent_incident')||'')||null,
   general_incident_label:String(fd.get('general_incident_label')||'')||null,
   planned_start:fd.get('planned_start')?new Date(String(fd.get('planned_start'))).toISOString():null,
   planned_end:fd.get('planned_end')?new Date(String(fd.get('planned_end'))).toISOString():null
  }
  if(selected.id){
   const {data,error}=await supabase.from('tickets').update(row).eq('id',selected.id).select().single()
   if(error){notify(error.message,'error');return}
   setSelected(data as Ticket);notify('Ticket modifié avec succès.')
  }else{
   row.ticket_number='INC-'+Date.now().toString().slice(-9);row.created_by=profile?.id
   const {data,error}=await supabase.from('tickets').insert(row).select().single()
   if(error){notify(error.message,'error');return}
   setSelected(data as Ticket);notify('Ticket créé avec succès.')
  }
  await qc.invalidateQueries({queryKey:['tickets']})
 }

 const addComment=async()=>{
  if(!selected?.id||!profile)return
  const body=prompt('Commentaire')
  if(!body?.trim())return
  const {error}=await supabase.from('ticket_comments').insert({ticket_id:selected.id,author_id:profile.id,body:body.trim()})
  if(error)notify(error.message,'error');else{notify('Commentaire ajouté.');await qc.invalidateQueries({queryKey:['comments',selected.id]})}
 }
 const close=async()=>{if(!selected?.id)return;const resolution=prompt('Commentaire de résolution obligatoire');if(!resolution?.trim())return;const {error}=await supabase.rpc('close_ticket',{p_ticket_id:selected.id,p_resolution:resolution.trim()});if(error)notify(error.message,'error');else{notify('Ticket clôturé.');setSelected(null);await qc.invalidateQueries({queryKey:['tickets']})}}
 const reopen=async()=>{if(!selected?.id)return;const {error}=await supabase.rpc('reopen_ticket',{p_ticket_id:selected.id});if(error)notify(error.message,'error');else{notify('Ticket rouvert.');setSelected(null);await qc.invalidateQueries({queryKey:['tickets']})}}

 const exportFiltered=async()=>{
  try{
   notify('Préparation de l’export détaillé…','info')
   const ids=rows.map(t=>t.id)
   const [commentsQ,historyQ,materialsQ,movementsQ]=ids.length?await Promise.all([
    supabase.from('ticket_comments').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('ticket_history').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('ticket_materials').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('inventory_movements').select('*').in('ticket_id',ids).order('created_at')
   ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null}] as any
   for(const q of [commentsQ,historyQ,materialsQ,movementsQ])if(q.error)throw q.error

   const wb=XLSX.utils.book_new()
   addSheet(wb,'Tickets filtrés',rows.map(t=>({
    id:t.id,numero_ticket:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client_id:t.customer_id||'',client:clientName(t.customer_id),
    customer_contact_id:t.customer_contact_id||'',description:t.description||'',categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,
    technicien_id:t.assigned_to||'',technicien:techName(t.assigned_to),date_arrivee:excelDate(t.arrival_at),debut_planifie:excelDate(t.planned_start),
    fin_planifie:excelDate(t.planned_end),incident_bloquant:t.is_blocking?'Oui':'Non',incident_parent:t.parent_incident||'',
    incident_general:t.general_incident_label||'',commentaire_resolution:t.resolution_comment||'',closed_by:t.closed_by||'',
    cloture_le:excelDate(t.closed_at),created_by:t.created_by||'',auteur_creation:techName(t.created_by),cree_le:excelDate(t.created_at),modifie_le:excelDate(t.updated_at)
   })))
   addSheet(wb,'Commentaires',(commentsQ.data||[]).map((c:any)=>({id:c.id,ticket_id:c.ticket_id,ticket:tickets.find(t=>t.id===c.ticket_id)?.ticket_number||'',auteur_id:c.author_id,auteur:c.author_name||techName(c.author_id),commentaire:c.body,date:excelDate(c.created_at)})))
   addSheet(wb,'Historique',(historyQ.data||[]).map((h:any)=>({id:h.id,ticket_id:h.ticket_id,ticket:tickets.find(t=>t.id===h.ticket_id)?.ticket_number||'',acteur_id:h.actor_id||'',acteur:techName(h.actor_id),action:h.action,date:excelDate(h.created_at),details:JSON.stringify(h.details||{}),...Object.fromEntries(Object.entries(h.details||{}).map(([k,v])=>['detail_'+k,typeof v==='object'?JSON.stringify(v):v]))})))
   addSheet(wb,'Matériel ticket',(materialsQ.data||[]).map((m:any)=>({id:m.id,ticket_id:m.ticket_id,ticket:tickets.find(t=>t.id===m.ticket_id)?.ticket_number||'',catalog_id:m.catalog_id||'',libelle:m.label,quantite:m.quantity,note:m.note||'',date:excelDate(m.created_at)})))
   addSheet(wb,'Mouvements stock',(movementsQ.data||[]).map((m:any)=>({id:m.id,ticket_id:m.ticket_id||'',ticket:m.ticket_number_snapshot||tickets.find(t=>t.id===m.ticket_id)?.ticket_number||'',item_id:m.item_id,type:m.movement_type,quantite:m.quantity,ancien_total:m.old_total,nouveau_total:m.new_total,allocation_id:m.allocation_id||'',beneficiaire:m.assignee||'',acteur_id:m.actor_id||'',acteur:techName(m.actor_id),motif:m.reason||'',note:m.note||'',date:excelDate(m.created_at)})))
   addSheet(wb,'Filtres',[{recherche:search||'',date_sur:dateField,du:from||'',au:to||'',technicien:technician?techName(technician):'Tous',demandeur:requester||'Tous',client:customer?clientName(customer):'Tous',statut:statusFilter||'Tous',priorite:priorityFilter||'Toutes',resultats:rows.length}])
   downloadWorkbook(wb,'PlanningSecuritas_Tickets_'+new Date().toISOString().slice(0,10)+'.xlsx')
   notify('Export détaillé des tickets téléchargé.')
  }catch(e:any){notify('Erreur export : '+(e?.message||'échec'),'error')}
 }

 return <div className="page tickets-page">
  <header className="page-head">
   <div><h1>Tickets</h1><p>{manager?'Vue équipe complète, filtres croisés et export détaillé.':'Tes tickets, filtres et export détaillé.'}</p></div>
   <div className="actions tickets-head-actions"><button className="secondary page-primary-action" onClick={()=>void exportFiltered()}><Download size={16}/> Export filtré</button><button className="primary page-primary-action" onClick={()=>setSelected({...emptyTicket(),assigned_to:manager?null:profile?.id||null})}><Plus size={16}/> Nouveau ticket</button></div>
  </header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><Search size={16}/><b>Recherche & filtres</b><span>{rows.length} résultat{rows.length>1?'s':''}</span></div>
   <div className="module-filter-grid ticket-filter-grid">
    <label className="wide-filter">Recherche<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Numéro, titre, demandeur, client, technicien…"/></label>
    <label>Date sur<select value={dateField} onChange={e=>setDateField(e.target.value as DateField)}><option value="created_at">Création</option><option value="arrival_at">Arrivée</option><option value="planned_start">Planifiée</option><option value="closed_at">Clôture</option></select></label>
    <label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    {manager&&<label>Technicien<select value={technician} onChange={e=>setTechnician(e.target.value)}><option value="">Tous</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}{p.active?'':' (inactif)'}</option>)}</select></label>}
    <label>Demandeur<select value={requester} onChange={e=>setRequester(e.target.value)}><option value="">Tous</option>{requesters.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Client<select value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Tous</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' (inactif)'}</option>)}</select></label>
    <label>Statut<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Tous</option>{cfg('status').map((x:any)=><option key={x.id} value={x.label}>{x.label}</option>)}</select></label>
    <label>Priorité<select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}><option value="">Toutes</option>{cfg('priority').map((x:any)=><option key={x.id} value={x.label}>{x.label}</option>)}</select></label>
    <button className="ghost filter-clear" onClick={clearFilters}>Effacer les filtres</button>
   </div>
  </section>

  <div className="table-wrap desktop-only"><table><thead><tr><th>Ticket</th><th>Demandeur</th><th>Client</th><th>Statut</th><th>Priorité</th><th>Technicien</th><th>Créé</th><th>Planifié</th></tr></thead><tbody>{rows.map(t=><tr key={t.id} className="clickable-row" onClick={()=>setSelected(t)}><td><b>{t.ticket_number}</b><br/><small>{t.subject}</small></td><td>{t.requester||'—'}</td><td>{clientName(t.customer_id)}</td><td><span className="badge">{t.status}</span></td><td>{t.priority}</td><td>{techName(t.assigned_to)}</td><td>{excelDate(t.created_at)}</td><td>{excelDate(t.planned_start)||'—'}</td></tr>)}</tbody></table></div>

  <div className="module-mobile-list">{rows.map(t=><article className="module-mobile-card clickable-row" key={t.id} onClick={()=>setSelected(t)}><div className="module-mobile-head"><div><b>{t.ticket_number} • {t.subject}</b><small>{clientName(t.customer_id)} • {t.requester||'Sans demandeur'}</small></div><span className="badge">{t.status}</span></div><div className="module-mobile-meta"><div><span>Priorité</span><b>{t.priority}</b></div><div><span>Technicien</span><b>{techName(t.assigned_to)}</b></div><div><span>Créé</span><b>{new Date(t.created_at).toLocaleDateString('fr-FR')}</b></div><div><span>Planifié</span><b>{t.planned_start?new Date(t.planned_start).toLocaleString('fr-FR'):'—'}</b></div></div></article>)}</div>

  {selected&&<DetailDrawer title={selected.id?selected.ticket_number||'Ticket':'Nouveau ticket'} subtitle={selected.id?'Détail complet du ticket':'Création'} onClose={()=>setSelected(null)}>
   {selected.id&&<div className="detail-summary-grid">
    <div><span>Demandeur</span><b>{selected.requester||'—'}</b></div><div><span>Client</span><b>{clientName(selected.customer_id)}</b></div>
    <div><span>Technicien</span><b>{techName(selected.assigned_to)}</b></div><div><span>Statut</span><b>{selected.status||'—'}</b></div>
    <div><span>Créé</span><b>{excelDate(selected.created_at)||'—'}</b></div><div><span>Modifié</span><b>{excelDate(selected.updated_at)||'—'}</b></div>
    <div><span>Arrivée</span><b>{excelDate(selected.arrival_at)||'—'}</b></div><div><span>Clôture</span><b>{excelDate(selected.closed_at)||'—'}</b></div>
   </div>}

   <form className="form-grid" onSubmit={save} key={selected.id||'new-ticket'}>
    <label className="full">Titre<input name="subject" defaultValue={selected.subject||''} required/></label>
    <label>Demandeur<input name="requester" defaultValue={selected.requester||''}/></label>
    <label>Client<select name="customer_id" defaultValue={selected.customer_id||''}><option value="">— Aucun —</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Catégorie<select name="category" defaultValue={selected.category||''}>{cfg('category').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Type<select name="type" defaultValue={selected.intervention_type||''}>{cfg('type').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Statut<select name="status" defaultValue={selected.status||''}>{cfg('status').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Priorité<select name="priority" defaultValue={selected.priority||''}>{cfg('priority').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Technicien<select name="assigned_to" defaultValue={selected.assigned_to||''} disabled={!manager}><option value="">Non affecté</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
    <label>Incident parent<input name="parent_incident" defaultValue={selected.parent_incident||''}/></label>
    <label>Incident général<input name="general_incident_label" defaultValue={selected.general_incident_label||''}/></label>
    <label>Début planifié<input name="planned_start" type="datetime-local" defaultValue={selected.planned_start?selected.planned_start.slice(0,16):''}/></label>
    <label>Fin planifiée<input name="planned_end" type="datetime-local" defaultValue={selected.planned_end?selected.planned_end.slice(0,16):''}/></label>
    <label className="full"><span><input name="blocking" type="checkbox" defaultChecked={selected.is_blocking}/> Incident bloquant</span></label>
    <label className="full">Description<textarea name="description" defaultValue={selected.description||''}/></label>
    <button className="primary full"><Save size={15}/> Enregistrer</button>
   </form>

   {selected.id&&<>
    <div className="actions ticket-detail-actions"><button className="secondary" onClick={()=>void addComment()}><MessageSquarePlus size={15}/> Commenter</button><button className="primary" onClick={()=>void close()}><CheckCircle2 size={15}/> Clôturer</button>{selected.closed_at&&<button className="ghost" onClick={()=>void reopen()}><RotateCcw size={15}/> Rouvrir</button>}</div>
    {selected.resolution_comment&&<div className="detail-description"><b>Résolution :</b> {selected.resolution_comment}</div>}

    <h3 className="section-title"><MessageSquarePlus size={15}/> Commentaires ({comments.length})</h3>
    <div className="planning-history-list">{comments.length===0&&<span className="muted">Aucun commentaire.</span>}{comments.map((c:any)=><div className="planning-comment-row" key={c.id}><b>{c.author_name||techName(c.author_id)}</b><small>{excelDate(c.created_at)}</small><p>{c.body}</p></div>)}</div>

    <h3 className="section-title"><History size={15}/> Historique ({history.length})</h3>
    <div className="planning-history-list">{history.length===0&&<span className="muted">Aucun historique.</span>}{history.map((h:any)=><details className="compact-history" key={h.id}><summary><b>{h.action}</b><small>{excelDate(h.created_at)} • {techName(h.actor_id)}</small></summary><pre>{JSON.stringify(h.details||{},null,2)}</pre></details>)}</div>

    <h3 className="section-title"><Package size={15}/> Matériel & stock</h3>
    <div className="planning-history-list">{materials.map((m:any)=><div className="planning-stock-row" key={'mat-'+m.id}><b>{m.label} × {m.quantity}</b><small>{excelDate(m.created_at)} • {m.note||'Sans note'}</small></div>)}{movements.map((m:any)=><details className="compact-history" key={'mov-'+m.id}><summary><b>{m.movement_type} × {m.quantity}</b><small>{excelDate(m.created_at)} • {m.reason||'Sans motif'}</small></summary><div className="detail-key-values"><div><span>Stock</span><b>{m.old_total??'—'} → {m.new_total??'—'}</b></div><div><span>Bénéficiaire</span><b>{m.assignee||'—'}</b></div><div><span>Acteur</span><b>{techName(m.actor_id)}</b></div><div><span>Note</span><b>{m.note||'—'}</b></div></div></details>)}{materials.length===0&&movements.length===0&&<span className="muted">Aucun matériel lié.</span>}</div>
   </>}
  </DetailDrawer>}
 </div>
}
