import { CheckCircle2,MessageSquareText,X } from 'lucide-react'

export function TicketClosureDialog({
 ticketNumber,value,onChange,onCommunication,onClose,onSubmit,busy
}:{
 ticketNumber:string
 value:string
 onChange:(value:string)=>void
 onCommunication:()=>void
 onClose:()=>void
 onSubmit:()=>Promise<void>
 busy:boolean
}){
 return <div className="drawer-backdrop notification-backdrop">
  <section className="notification-dialog closure-dialog" role="dialog" aria-modal="true">
   <header className="notification-dialog-head"><CheckCircle2 size={21}/><div><small>Clôture du ticket</small><h2>{ticketNumber}</h2></div></header>
   <p className="muted">La résolution est obligatoire et sera conservée dans le ticket et son historique.</p>
   <textarea className="closure-textarea" value={value} onChange={e=>onChange(e.target.value)} rows={9} placeholder="Décris la résolution, les actions réalisées et le résultat obtenu…"/>
   <div className="closure-dialog-actions">
    <button className="secondary" onClick={onCommunication}><MessageSquareText size={15}/> Communication</button>
    <button className="primary" onClick={()=>void onSubmit()} disabled={busy||!value.trim()}><CheckCircle2 size={15}/>{busy?' Clôture…':' Clôturer le ticket'}</button>
    <button className="ghost" onClick={onClose} disabled={busy}><X size={15}/> Annuler</button>
   </div>
  </section>
 </div>
}
