import { FormEvent,useMemo,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { Clipboard,Copy,Mail,MessageSquareText,Plus,Save,Trash2,X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { CommunicationTemplate } from '../lib/types'

export function CommunicationsPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()
 const [search,setSearch]=useState('')
 const [theme,setTheme]=useState('')
 const [selected,setSelected]=useState<CommunicationTemplate|null>(null)
 const [creating,setCreating]=useState(false)
 const [message,setMessage]=useState('')

 const {data:templates=[]}=useQuery({
  queryKey:['communication_templates'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('communication_templates').select('*').order('theme').order('sort_order').order('title')
   if(error)throw error
   return data as CommunicationTemplate[]
  }
 })

 const outlookTemplates=useMemo(()=>templates.filter(t=>t.channel==='Outlook'),[templates])
 const themes=useMemo(()=>[...new Set(outlookTemplates.map(t=>t.theme))].sort(),[outlookTemplates])
 const rows=useMemo(()=>outlookTemplates.filter(t=>{
  const q=search.trim().toLowerCase()
  const txt=(t.theme+' '+t.title+' '+(t.subject||'')+' '+t.body).toLowerCase()
  if(q&&!txt.includes(q))return false
  if(theme&&t.theme!==theme)return false
  return t.active||manager
 }),[outlookTemplates,search,theme,manager])

 const openTemplate=(t:CommunicationTemplate)=>{setSelected(t);setCreating(false);setMessage('')}
 const newTemplate=()=>{setSelected(null);setCreating(true);setMessage('')}

 const copyText=async(text:string,label:string)=>{
  await navigator.clipboard.writeText(text)
  setMessage(label+' copié')
  setTimeout(()=>setMessage(''),1800)
 }

 const copyAll=async(t:CommunicationTemplate)=>{
  const text=[t.subject?('Objet : '+t.subject):'',t.body].filter(Boolean).join('\n\n')
  await copyText(text,'Modèle')
 }

 const openMail=(t:CommunicationTemplate)=>{
  window.location.href='mailto:?subject='+encodeURIComponent(t.subject||'')+'&body='+encodeURIComponent(t.body)
 }

 const duplicate=async(t:CommunicationTemplate)=>{
  const scope=manager?'team':'personal'
  const {error}=await supabase.from('communication_templates').insert({
   theme:t.theme,channel:'Outlook',title:t.title+' - copie',subject:t.subject,body:t.body,
   scope,owner_id:scope==='personal'?profile?.id:null,is_system:false,active:true,sort_order:t.sort_order+1,created_by:profile?.id
  })
  if(error){alert(error.message);return}
  await qc.invalidateQueries({queryKey:['communication_templates']})
 }

 const remove=async(t:CommunicationTemplate)=>{
  if(!confirm('Supprimer le modèle "'+t.title+'" ?'))return
  const {error}=await supabase.from('communication_templates').delete().eq('id',t.id)
  if(error){alert(error.message);return}
  setSelected(null)
  await qc.invalidateQueries({queryKey:['communication_templates']})
 }

 const save=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  const fd=new FormData(e.currentTarget)
  const requestedScope=String(fd.get('scope')||'personal')
  const scope=manager&&requestedScope==='team'?'team':'personal'
  const row={
   theme:String(fd.get('theme')||'').trim(),
   channel:'Outlook',
   title:String(fd.get('title')||'').trim(),
   subject:String(fd.get('subject')||'').trim()||null,
   body:String(fd.get('body')||'').trim(),
   scope,
   owner_id:scope==='personal'?profile?.id:null,
   active:fd.get('active')==='on',
   created_by:profile?.id
  }
  if(!row.theme||!row.title||!row.body){alert('Thème, titre et contenu sont obligatoires');return}
  const q=selected
   ?supabase.from('communication_templates').update(row).eq('id',selected.id)
   :supabase.from('communication_templates').insert(row)
  const {error}=await q
  if(error){alert(error.message);return}
  setSelected(null);setCreating(false)
  await qc.invalidateQueries({queryKey:['communication_templates']})
 }

 const canEdit=(t:CommunicationTemplate)=>manager||(t.scope==='personal'&&t.owner_id===profile?.id)

 return <div className="page communications-page">
  <header className="page-head">
   <div><h1>Centre de communication</h1><p>Modèles Outlook prêts à copier ou à ouvrir directement en nouveau mail.</p></div>
   <button className="primary page-primary-action" onClick={newTemplate}><Plus size={16}/> Nouveau modèle Outlook</button>
  </header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><MessageSquareText size={16}/><b>Recherche & filtres</b><span>{rows.length} modèle{rows.length>1?'s':''}</span></div>
   <div className="module-filter-grid">
    <label className="wide-filter">Recherche<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Caméra, NVR, switch, alarme, chantier, maintenance…"/></label>
    <label>Thème<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="">Tous</option>{themes.map(x=><option key={x}>{x}</option>)}</select></label>
   </div>
  </section>

  <div className={(selected||creating)?'module-layout with-detail':'module-layout'}>
   <section className="communication-grid">
    {rows.map(t=><article className={'communication-card '+(selected?.id===t.id?'selected':'')} key={t.id} onClick={()=>openTemplate(t)}>
     <div className="communication-card-head"><div><span className="reference-category">{t.theme}</span><b>{t.title}</b><small>Outlook • {t.scope==='team'?'Équipe':'Personnel'}</small></div><Mail size={18}/></div>
     {t.subject&&<div className="communication-subject">{t.subject}</div>}
     <p>{t.body.slice(0,190)}{t.body.length>190?'…':''}</p>
     <div className="communication-card-actions">
      <button className="secondary small" onClick={e=>{e.stopPropagation();void copyAll(t)}}><Clipboard size={14}/> Copier</button>
      <button className="primary small" onClick={e=>{e.stopPropagation();openMail(t)}}><Mail size={14}/> Ouvrir Outlook</button>
     </div>
    </article>)}
   </section>

   {(selected||creating)&&<aside className="panel detail-panel">
    <div className="detail-panel-head"><div><small>{creating?'Création Outlook':'Modèle Outlook'}</small><h2><Mail size={18}/>{creating?' Nouveau modèle':selected?.title}</h2></div><button className="ghost small" onClick={()=>{setSelected(null);setCreating(false)}}><X size={15}/></button></div>

    {selected&&!creating&&<>
     <div className="communication-detail-actions">
      {selected.subject&&<button className="ghost" onClick={()=>void copyText(selected.subject||'','Objet')}><Copy size={14}/> Copier objet</button>}
      <button className="secondary" onClick={()=>void copyText(selected.body,'Message')}><Clipboard size={14}/> Copier message</button>
      <button className="primary" onClick={()=>openMail(selected)}><Mail size={14}/> Ouvrir Outlook</button>
      <button className="ghost" onClick={()=>void duplicate(selected)}><Copy size={14}/> Dupliquer</button>
     </div>
     {message&&<div className="alert">{message}</div>}
    </>}

    <form className="form-grid detail-form" onSubmit={save} key={selected?.id||'new-template'}>
     <label className="full">Thème<input name="theme" defaultValue={selected?.theme||''} placeholder="Réseau, Vidéosurveillance, Alarme, Chantier…" required/></label>
     <label className="full">Titre<input name="title" defaultValue={selected?.title||''} required/></label>
     <label className="full">Objet Outlook<input name="subject" defaultValue={selected?.subject||''}/></label>
     <label className="full">Message Outlook<textarea name="body" defaultValue={selected?.body||''} rows={14} placeholder={'Bonjour,\n\nSite :\nTicket :\nConstat :\nAction :\n\nCordialement,'} required/></label>
     <label>Portée<select name="scope" defaultValue={selected?.scope||(manager?'team':'personal')} disabled={!manager}><option value="personal">Personnel</option>{manager&&<option value="team">Équipe</option>}</select></label>
     <label className="check-label"><input name="active" type="checkbox" defaultChecked={selected?.active??true}/> Actif</label>
     {(creating||!selected||canEdit(selected))&&<button className="primary full"><Save size={15}/> Enregistrer</button>}
    </form>
    {selected&&canEdit(selected)&&<button className="danger full-width-danger" onClick={()=>void remove(selected)}><Trash2 size={15}/> Supprimer le modèle</button>}
   </aside>}
  </div>
 </div>
}
