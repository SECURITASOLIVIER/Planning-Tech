import type { CommunicationTemplate,Ticket } from './types'

export interface TicketCommunicationContext{
 ticket:Ticket
 clientName:string
 technicianName:string
}

function escapeRegExp(value:string){
 return value.replace(/[.*+?^$()|[\]\\]/g,'\\$&')
}

function replaceLine(body:string,label:string,value:string){
 const re=new RegExp('(^|\\n)'+escapeRegExp(label)+'\\s*:[^\\n]*','i')
 if(re.test(body))return body.replace(re,(_m,prefix)=>prefix+label+' : '+value)
 return body
}

export function applyTicketContext(template:CommunicationTemplate,ctx:TicketCommunicationContext){
 const t=ctx.ticket
 let body=template.body
 const fields:[string,string][]=[
  ['Ticket',t.ticket_number],
  ['Client',ctx.clientName],
  ['Site',ctx.clientName],
  ['Demandeur',t.requester||'—'],
  ['Technicien',ctx.technicianName],
  ['Statut',t.status],
  ['Priorité',t.priority],
  ['Catégorie',t.category],
  ['Type',t.intervention_type],
  ['Date',t.planned_start?new Date(t.planned_start).toLocaleString('fr-FR'):'—']
 ]
 for(const [label,value] of fields)body=replaceLine(body,label,value)

 const contextBlock=[
  'Ticket : '+t.ticket_number,
  'Client : '+ctx.clientName,
  'Demandeur : '+(t.requester||'—'),
  'Technicien : '+ctx.technicianName,
  'Statut : '+t.status,
  'Priorité : '+t.priority
 ].join('\n')

 if(!/^Ticket\s*:/im.test(body))body=body.trim()+'\n\n'+contextBlock

 return {
  subject:(template.subject||'').replaceAll('[TICKET]',t.ticket_number).replaceAll('{{ticket}}',t.ticket_number),
  body
 }
}

export function mailtoForTemplate(recipients:string[],subject:string,body:string){
 const to=recipients.map(x=>x.trim()).filter(Boolean).join(',')
 return 'mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)
}
