import type { Ticket } from './types'

export type TicketNotificationType='create'|'update'|'comment'|'close'|'reopen'

export interface TicketNotificationHistoryItem{
 id:string|number
 kind?:'history'|'comment'
 action:string
 created_at:string
 actor_id:string|null
 actor_name:string
 details:Record<string,unknown>|null
 old_assigned_name?:string|null
 new_assigned_name?:string|null
 old_customer_name?:string|null
 new_customer_name?:string|null
}

export interface TicketNotificationHistory{
 total:number
 items:TicketNotificationHistoryItem[]
}

function fmtDate(value:unknown){
 if(!value||typeof value!=='string')return '—'
 const d=new Date(value)
 return Number.isNaN(d.getTime())?String(value):d.toLocaleString('fr-FR')
}

function fmtValue(value:unknown,type?:'date'|'boolean'|'money'){
 if(value===null||value===undefined||value==='')return '—'
 if(type==='date')return fmtDate(value)
 if(type==='boolean')return value===true||value==='true'?'Oui':'Non'
 if(type==='money')return Number(value||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})
 return String(value)
}

function actionLabel(action:string){
 const labels:Record<string,string>={
  created:'Création',
  updated:'Mise à jour',
  comment_notification:'Commentaire notification',
  closed:'Clôture',
  reopened:'Réouverture',
  material_added:'Matériel ajouté',
  material_updated:'Matériel corrigé',
  material_removed:'Matériel retiré',
  stock_movement:'Mouvement de stock'
 }
 return labels[action]||action
}

function formatHistoryItem(item:TicketNotificationHistoryItem){
 const d=(item.details||{}) as Record<string,unknown>
 const prefix=fmtDate(item.created_at)+' — '+(item.actor_name||'Utilisateur')+' — '+actionLabel(item.action)

 if(item.action==='comment_notification'){
  return prefix+'\n  '+String(d.body||'')
 }

 if(item.action==='material_added'||item.action==='material_removed'){
  return prefix+' — '+String(d.label||'Matériel')+' × '+String(d.quantity||1)+(d.note?' — '+String(d.note):'')
 }

 if(item.action==='material_updated'){
  const changes:string[]=[]
  if(d.old_label!==d.new_label)changes.push('Matériel : '+fmtValue(d.old_label)+' → '+fmtValue(d.new_label))
  if(d.old_quantity!==d.new_quantity)changes.push('Quantité : '+fmtValue(d.old_quantity)+' → '+fmtValue(d.new_quantity))
  if(d.old_note!==d.new_note)changes.push('Note : '+fmtValue(d.old_note)+' → '+fmtValue(d.new_note))
  return changes.length?prefix+' — '+changes.join(' ; '):prefix
 }

 if(item.action==='stock_movement'){
  return prefix+' — '+String(d.movement_type||'Mouvement')+' × '+String(d.quantity||1)
   +(d.reason?' — '+String(d.reason):'')
   +(d.total_cost_snapshot!==undefined?' — coût '+fmtValue(d.total_cost_snapshot,'money'):'')
 }

 if(item.action==='created'){
  return prefix
 }

 const changes:string[]=[]
 const fields=[
  ['subject','Objet'],
  ['requester','Demandeur'],
  ['description','Description'],
  ['category','Catégorie'],
  ['intervention_type','Type'],
  ['status','Statut'],
  ['priority','Priorité'],
  ['arrival_at','Arrivée','date'],
  ['planned_start','Début planifié','date'],
  ['planned_end','Fin planifiée','date'],
  ['is_blocking','Bloquant','boolean'],
  ['parent_incident','Incident parent'],
  ['general_incident_label','Incident général'],
  ['customer_contact_id','Contact client'],
  ['intervention_cost','Coût intervention','money'],
  ['intervention_cost_note','Note coût'],
  ['resolution_comment','Résolution'],
  ['closed_at','Date clôture','date']
 ] as const

 for(const [key,label,type] of fields){
  const oldKey='old_'+key,newKey='new_'+key
  if(Object.prototype.hasOwnProperty.call(d,oldKey)&&Object.prototype.hasOwnProperty.call(d,newKey)&&d[oldKey]!==d[newKey]){
   changes.push(label+' : '+fmtValue(d[oldKey],type)+' → '+fmtValue(d[newKey],type))
  }
 }

 if(Object.prototype.hasOwnProperty.call(d,'old_assigned_to')&&d.old_assigned_to!==d.new_assigned_to){
  changes.push('Technicien : '+fmtValue(item.old_assigned_name||d.old_assigned_to)+' → '+fmtValue(item.new_assigned_name||d.new_assigned_to))
 }
 if(Object.prototype.hasOwnProperty.call(d,'old_customer_id')&&d.old_customer_id!==d.new_customer_id){
  changes.push('Client : '+fmtValue(item.old_customer_name||d.old_customer_id)+' → '+fmtValue(item.new_customer_name||d.new_customer_id))
 }

 return changes.length?prefix+'\n  '+changes.join('\n  '):prefix
}

export function buildTicketNotification(
 type:TicketNotificationType,
 ticket:Ticket,
 clientName:string,
 technicianName:string,
 history?:TicketNotificationHistory
){
 const labels:Record<TicketNotificationType,string>={
  create:'Nouveau ticket',
  update:'Mise à jour ticket',
  comment:'Nouveau commentaire',
  close:'Clôture ticket',
  reopen:'Réouverture ticket'
 }
 const subject='['+labels[type]+'] '+ticket.ticket_number+' - '+ticket.subject
 const lines=[
  'Bonjour,',
  '',
  labels[type]+' :',
  '',
  'Ticket : '+ticket.ticket_number,
  'Objet : '+ticket.subject,
  'Client : '+clientName,
  'Demandeur : '+(ticket.requester||'—'),
  'Technicien : '+technicianName,
  'Statut : '+ticket.status,
  'Priorité : '+ticket.priority,
  'Catégorie : '+ticket.category,
  'Type : '+ticket.intervention_type,
  'Planifié : '+(ticket.planned_start?new Date(ticket.planned_start).toLocaleString('fr-FR'):'—'),
  'Fin prévue : '+(ticket.planned_end?new Date(ticket.planned_end).toLocaleString('fr-FR'):'—'),
  'Bloquant : '+(ticket.is_blocking?'Oui':'Non'),
  '',
  'Description :',
  ticket.description||'—'
 ]

 if(type==='close'){
  lines.push('','Résolution :',ticket.resolution_comment||'—','Clôturé le : '+(ticket.closed_at?new Date(ticket.closed_at).toLocaleString('fr-FR'):'—'))
 }

 if(history?.items?.length){
  lines.push('','','Historique des mises à jour et commentaires de notification :')
  for(const item of history.items){
   lines.push('',formatHistoryItem(item))
  }
 }

 lines.push('','','Cordialement,')
 return {subject,body:lines.join('\n')}
}

export function mailtoComposeUrl(recipients:string[],subject:string,body:string){
 const to=recipients.map(x=>x.trim()).filter(Boolean).join(',')
 return 'mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)
}
