import { useMemo,useState } from 'react'
import { Clipboard,Mail,MessageSquareText,Search,X } from 'lucide-react'
import type { CommunicationTemplate } from '../lib/types'

export function TicketCommunicationPicker({
 templates,onClose,onInsert,onCopy,onMail,target
}:{
 templates:CommunicationTemplate[]
 onClose:()=>void
 onInsert:(template:CommunicationTemplate)=>void
 onCopy:(template:CommunicationTemplate)=>void
 onMail:(template:CommunicationTemplate)=>void
 target:'comment'|'closure'
}){
 const [search,setSearch]=useState('')
 const [theme,setTheme]=useState('')
 const themes=useMemo(()=>[...new Set(templates.map(t=>t.theme))].sort(),[templates])
 const rows=useMemo(()=>templates.filter(t=>{
  const q=search.trim().toLowerCase()
  if(theme&&t.theme!==theme)return false
  if(q&&!((t.theme+' '+t.title+' '+(t.subject||'')+' '+t.body).toLowerCase().includes(q)))return false
  return t.active
 }),[templates,search,theme])

 return <div className="drawer-backdrop communication-picker-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="communication-picker" role="dialog" aria-modal="true">
   <header className="drawer-head">
    <div><small>Centre de communication</small><h2>{target==='comment'?'Insérer dans le commentaire':'Préparer la résolution'}</h2></div>
    <button className="ghost square-action" onClick={onClose}><X size={17}/></button>
   </header>
   <div className="communication-picker-body">
    <div className="communication-picker-filters">
     <label className="wide-filter">Recherche<div className="input-with-icon"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Caméra, NVR, réseau, alarme, maintenance…"/></div></label>
     <label>Thème<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="">Tous</option>{themes.map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <div className="communication-picker-list">
     {rows.map(t=><article className="communication-picker-card" key={t.id}>
      <div><span className="reference-category">{t.theme}</span><b>{t.title}</b>{t.subject&&<small>{t.subject}</small>}<p>{t.body.slice(0,220)}{t.body.length>220?'…':''}</p></div>
      <div className="communication-picker-actions">
       <button className="primary small" onClick={()=>onInsert(t)}><MessageSquareText size={14}/> {target==='comment'?'Insérer':'Utiliser'}</button>
       <button className="secondary small" onClick={()=>onCopy(t)}><Clipboard size={14}/> Copier</button>
       <button className="ghost small" onClick={()=>onMail(t)}><Mail size={14}/> App mail</button>
      </div>
     </article>)}
     {rows.length===0&&<div className="muted">Aucun modèle correspondant.</div>}
    </div>
   </div>
  </section>
 </div>
}
