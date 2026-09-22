import { CheckCircle2,Mail,Send,XCircle } from 'lucide-react'
import { useState } from 'react'
import { outlookComposeUrl, type TicketNotificationType } from '../lib/ticketNotification'

export interface PendingTicketNotification{
 ticketId:string
 ticketNumber:string
 type:TicketNotificationType
 recipients:string[]
 subject:string
 body:string
}

export function TicketNotificationDialog({
 notification,onConfirm
}:{notification:PendingTicketNotification;onConfirm:(confirmed:boolean,outlookOpened:boolean)=>Promise<void>}){
 const [opened,setOpened]=useState(false)
 const [busy,setBusy]=useState(false)

 const openOutlook=()=>{
  const url=outlookComposeUrl(notification.recipients,notification.subject,notification.body)
  window.open(url,'_blank','noopener,noreferrer')
  setOpened(true)
 }

 const finish=async(confirmed:boolean)=>{
  setBusy(true)
  try{await onConfirm(confirmed,opened)}finally{setBusy(false)}
 }

 return <div className="drawer-backdrop notification-backdrop">
  <section className="notification-dialog" role="dialog" aria-modal="true">
   <header className="notification-dialog-head"><Mail size={21}/><div><small>Notification ticket</small><h2>{notification.ticketNumber}</h2></div></header>
   <p className="notification-question">Avez-vous envoyé la notification à tous les destinataires ?</p>
   <div className="notification-recipients"><span>Destinataires</span>{notification.recipients.length?notification.recipients.map(x=><b key={x}>{x}</b>):<b className="warning-text">Aucun destinataire configuré</b>}</div>
   <div className="notification-preview"><span>Objet Outlook</span><b>{notification.subject}</b><pre>{notification.body}</pre></div>
   <div className="notification-actions">
    <button className="secondary" onClick={openOutlook} disabled={!notification.recipients.length||busy}><Send size={15}/> Ouvrir Outlook</button>
    <button className="primary" onClick={()=>void finish(true)} disabled={busy||!notification.recipients.length}><CheckCircle2 size={15}/> Oui, envoyé à tous</button>
    <button className="ghost" onClick={()=>void finish(false)} disabled={busy}><XCircle size={15}/> Pas encore envoyé</button>
   </div>
   <small className="notification-proof">La confirmation est journalisée avec l’utilisateur, la date, les destinataires et le type de notification.</small>
  </section>
 </div>
}
