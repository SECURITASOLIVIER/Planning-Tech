import { useEffect,useState } from 'react'
import { CheckCircle2,Info,XCircle } from 'lucide-react'
import type { NoticeKind } from '../lib/notify'

type Notice={id:number;message:string;kind:NoticeKind}

export function ToastHost(){
 const [notices,setNotices]=useState<Notice[]>([])
 useEffect(()=>{
  const handler=(event:Event)=>{
   const detail=(event as CustomEvent<Notice>).detail
   setNotices(prev=>[...prev.slice(-2),detail])
   window.setTimeout(()=>setNotices(prev=>prev.filter(n=>n.id!==detail.id)),3800)
  }
  window.addEventListener('planning-notice',handler)
  return()=>window.removeEventListener('planning-notice',handler)
 },[])
 return <div className="toast-host" aria-live="polite">
  {notices.map(n=><div key={n.id} className={'toast '+n.kind}>
   {n.kind==='success'?<CheckCircle2 size={17}/>:n.kind==='error'?<XCircle size={17}/>:<Info size={17}/>}
   <span>{n.message}</span>
  </div>)}
 </div>
}
