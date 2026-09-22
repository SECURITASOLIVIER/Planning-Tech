import type { Ticket } from './types'

export type TicketNotificationType='create'|'update'|'close'|'reopen'

export function buildTicketNotification(
 type:TicketNotificationType,
 ticket:Ticket,
 clientName:string,
 technicianName:string
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
 lines.push('','','Cordialement,')
 return {subject,body:lines.join('\n')}
}

export function outlookComposeUrl(recipients:string[],subject:string,body:string){
 const params=new URLSearchParams()
 params.set('to',recipients.join(';'))
 params.set('subject',subject)
 params.set('body',body)
 return 'https://outlook.office.com/mail/deeplink/compose?'+params.toString()
}
