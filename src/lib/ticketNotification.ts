import type { Ticket } from './types'

export type TicketNotificationType='create'|'update'|'close'|'reopen'

export interface TicketNotificationHistoryItem{
 id:number
 action:string
 created_at:string
 actor_id:string|null
 actor_name:string
 details:Record<string,unknown>|null
 old_assigned_name?:string|null
 new_assigned_name?:string|null
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

function actionLabel(action:string){
 const labels:Record<string,string>={
  created:'Création',
  updated:'Mise à jour',
  closed:'Clôture',
  reopened:'Réouverture'
 }
 return labels[action]||action
}

function formatHistoryItem(item:TicketNotificationHistoryItem){
 const d=(item.details||{}) as Record<string,unknown>
 const changes:string[]=[]

 if(d.old_status!==undefined&&d.new_status!==undefined&&d.old_status!==d.new_status){
  changes.push('Statut : '+String(d.old_status??'—')+' → '+String(d.new_status??'—'))
 }
 if(d.old_assigned_to!==undefined&&d.new_assigned_to!==undefined&&d.old_assigned_to!==d.new_assigned_to){
  changes.push('Technicien : '+(item.old_assigned_name||String(d.old_assigned_to??'Non affecté'))+' → '+(item.new_assigned_name||String(d.new_assigned_to??'Non affecté')))
 }
 if(d.old_planned_start!==undefined&&d.new_planned_start!==undefined&&d.old_planned_start!==d.new_planned_start){
  changes.push('Début : '+fmtDate(d.old_planned_start)+' → '+fmtDate(d.new_planned_start))
 }
 if(d.old_planned_end!==undefined&&d.new_planned_end!==undefined&&d.old_planned_end!==d.new_planned_end){
  changes.push('Fin : '+fmtDate(d.old_planned_end)+' → '+fmtDate(d.new_planned_end))
 }

 const prefix=fmtDate(item.created_at)+' — '+(item.actor_name||'Utilisateur')+' — '+actionLabel(item.action)
 return changes.length?prefix+' — '+changes.join(' ; '):prefix
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
  lines.push('','','Historique des mises à jour :')
  for(const item of history.items)lines.push('- '+formatHistoryItem(item))
  if(history.total>history.items.length){
   lines.push('','Historique affiché : '+history.items.length+' dernières actions sur '+history.total+'. Le détail complet reste disponible dans le ticket.')
  }
 }

 lines.push('','','Cordialement,')
 return {subject,body:lines.join('\n')}
}

export function mailtoComposeUrl(recipients:string[],subject:string,body:string){
 const to=recipients.map(x=>x.trim()).filter(Boolean).join(',')
 return 'mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)
}
