import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { addSheet,downloadWorkbook,excelDate } from './excel'

export async function exportManagerWorkbook(from:string,to:string){
 const end=new Date(new Date(to+'T00:00:00').getTime()+86400000).toISOString()
 const start=from+'T00:00:00'

 const [ticketsQ,commentsQ,profilesQ,clientsQ,inventoryQ,movementsQ,historyQ,kpiQ]=await Promise.all([
  supabase.from('tickets').select('*').order('created_at'),
  supabase.from('ticket_comments').select('*').gte('created_at',start).lt('created_at',end).order('created_at'),
  supabase.from('profiles').select('*').order('display_name'),
  supabase.from('customers').select('*').order('name'),
  supabase.from('inventory_items').select('*').order('category').order('model'),
  supabase.from('inventory_movements').select('*').gte('created_at',start).lt('created_at',end).order('created_at'),
  supabase.from('ticket_history').select('*').gte('created_at',start).lt('created_at',end).order('created_at'),
  supabase.rpc('kpi_dashboard',{p_from:from,p_to:to})
 ])
 for(const q of [ticketsQ,commentsQ,profilesQ,clientsQ,inventoryQ,movementsQ,historyQ]) if(q.error) throw q.error
 if(kpiQ.error)throw kpiQ.error

 const tickets=ticketsQ.data||[]
 const profiles=profilesQ.data||[]
 const clients=clientsQ.data||[]
 const inventory=inventoryQ.data||[]
 const movements=movementsQ.data||[]
 const history=historyQ.data||[]
 const comments=commentsQ.data||[]
 const kpi=kpiQ.data as any
 const profileName=(id:string|null)=>profiles.find((p:any)=>p.id===id)?.display_name||''
 const clientName=(id:string|null)=>clients.find((c:any)=>c.id===id)?.name||''
 const itemName=(id:string)=>{const i=inventory.find((x:any)=>x.id===id);return i?[i.manufacturer,i.model].filter(Boolean).join(' '):id}

 const periodTickets=tickets.filter((t:any)=>{
  const created=new Date(t.created_at).getTime()
  const planned=t.planned_start?new Date(t.planned_start).getTime():0
  const closed=t.closed_at?new Date(t.closed_at).getTime():0
  const s=new Date(start).getTime(),e=new Date(end).getTime()
  return (created>=s&&created<e)||(planned>=s&&planned<e)||(closed>=s&&closed<e)
 })

 const wb=XLSX.utils.book_new()
 addSheet(wb,'Synthèse',[{du:from,au:to,...(kpi?.summary||{})}])
 addSheet(wb,'KPI Techniciens',kpi?.by_technician||[])
 addSheet(wb,'Tickets',periodTickets.map((t:any)=>({
  id:t.id,numero:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client:clientName(t.customer_id),
  description:t.description||'',categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,
  technicien:profileName(t.assigned_to),technicien_id:t.assigned_to||'',arrivee:excelDate(t.arrival_at),
  debut_planifie:excelDate(t.planned_start),fin_planifie:excelDate(t.planned_end),bloquant:t.is_blocking?'Oui':'Non',
  incident_parent:t.parent_incident||'',incident_general:t.general_incident_label||'',resolution:t.resolution_comment||'',
  cout_intervention:Number(t.intervention_cost||0),note_cout_intervention:t.intervention_cost_note||'',
  cloture:excelDate(t.closed_at),auteur:profileName(t.created_by),cree_le:excelDate(t.created_at),modifie_le:excelDate(t.updated_at)
 })))
 addSheet(wb,'Planning',periodTickets.filter((t:any)=>t.planned_start).map((t:any)=>({
  ticket:t.ticket_number,titre:t.subject,client:clientName(t.customer_id),technicien:profileName(t.assigned_to),
  debut:excelDate(t.planned_start),fin:excelDate(t.planned_end),statut:t.status,priorite:t.priority,categorie:t.category,type:t.intervention_type,
  demandeur:t.requester||'',bloquant:t.is_blocking?'Oui':'Non',description:t.description||'',cout_intervention:Number(t.intervention_cost||0),note_cout_intervention:t.intervention_cost_note||''
 })))
 addSheet(wb,'Commentaires',comments.map((c:any)=>({
  ticket:tickets.find((t:any)=>t.id===c.ticket_id)?.ticket_number||c.ticket_id,
  auteur:c.author_name||profileName(c.author_id),date:excelDate(c.created_at),commentaire:c.body
 })))
 addSheet(wb,'Historique tickets',history.map((h:any)=>({
  ticket:tickets.find((t:any)=>t.id===h.ticket_id)?.ticket_number||h.ticket_id,
  acteur:profileName(h.actor_id)||h.actor_id||'Système',action:h.action,date:excelDate(h.created_at),details:JSON.stringify(h.details||{})
 })))
 addSheet(wb,'Inventaire',inventory.map((i:any)=>({
  id:i.id,categorie:i.category,constructeur:i.manufacturer||'',modele:i.model,reference:i.reference||'',description:i.description||'',
  prix_unitaire:Number(i.unit_price||0),quantite_totale:i.quantity_total,reserve:i.quantity_reserved,attribue:i.quantity_assigned,
  disponible:i.quantity_total-i.quantity_reserved-i.quantity_assigned,stock_minimum:i.stock_minimum,emplacement:i.location||'',
  suivi_unitaire:i.tracked_individually?'Oui':'Non',actif:i.active?'Oui':'Non',cree_le:excelDate(i.created_at),modifie_le:excelDate(i.updated_at)
 })))
 addSheet(wb,'Mouvements stock',movements.map((m:any)=>({
  id:m.id,date:excelDate(m.created_at),materiel:itemName(m.item_id),item_id:m.item_id,type:m.movement_type,quantite:m.quantity,
  prix_unitaire_snapshot:Number(m.unit_price_snapshot||0),cout_total_snapshot:Number(m.total_cost_snapshot||0),
  ancien_total:m.old_total,nouveau_total:m.new_total,ticket:m.ticket_number_snapshot||'',ticket_id:m.ticket_id||'',
  beneficiaire:m.assignee||'',acteur:profileName(m.actor_id)||m.actor_id||'',motif:m.reason||'',note:m.note||''
 })))
 addSheet(wb,'Techniciens',profiles.filter((p:any)=>p.role==='technician').map((p:any)=>({
  id:p.id,nom:p.display_name,email:p.email||'',actif:p.active?'Oui':'Non',debut_habituel:p.work_start,fin_habituelle:p.work_end,cree_le:excelDate(p.created_at)
 })))
 addSheet(wb,'Clients',clients.map((c:any)=>({
  id:c.id,code:c.code||'',nom:c.name,type:c.type,email:c.email||'',telephone:c.phone||'',adresse:c.address||'',
  ville:c.city||'',code_postal:c.postal_code||'',pays:c.country||'',notes:c.notes||'',actif:c.active?'Oui':'Non',
  cree_le:excelDate(c.created_at),modifie_le:excelDate(c.updated_at)
 })))

 downloadWorkbook(wb,'PlanningSecuritas_'+from+'_'+to+'.xlsx')
}
