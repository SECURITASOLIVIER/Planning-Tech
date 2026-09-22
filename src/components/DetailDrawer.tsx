import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function DetailDrawer({title,subtitle,onClose,children}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode}){
 return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <aside className="detail-drawer" role="dialog" aria-modal="true">
   <header className="drawer-head">
    <div>{subtitle&&<small>{subtitle}</small>}<h2>{title}</h2></div>
    <button className="ghost square-action" onClick={onClose} aria-label="Fermer"><X size={17}/></button>
   </header>
   <div className="drawer-body">{children}</div>
  </aside>
 </div>
}
