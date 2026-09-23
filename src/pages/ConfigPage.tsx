import { FormEvent,useRef,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup,Download,Mail,Plus,Trash2,Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { runCompleteBusinessBackup } from '../lib/exportDatabase'\nimport { importCompleteBusinessDatabase } from '../lib/importDatabase'
import { notify } from '../lib/notify'

const kinds=[['status','Statuts'],['priority','Priorités'],['category','Catégories'],['type','Types']]

export function ConfigPage(){
 const qc=useQueryClient()
 const [kind,setKind]=useState('status')
 const [backupBusy,setBackupBusy]=useState(false)\n const [importBusy,setImportBusy]=useState(false)\n const [importProgress,setImportProgress]=useState('')\n const importRef=useRef<HTMLInputElement|null>(null)

 const {data=[]}=useQuery({queryKey:['config'],queryFn:async()=>{const {data,error}=await supabase.from('config_values').select('*').order('sort_order');if(error)throw error;return data||[]}})
 const {data:distribution=[]}=useQuery({queryKey:['notification-distribution'],queryFn:async()=>{const {data,error}=await supabase.from('notification_distribution_recipients').select('*').order('sort_order').order('email');if(error)throw error;return data||[]}})

 const rows=data.filter((x:any)=>x.kind===kind)

 const add=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  const fd=new FormData(e.currentTarget)
  const {error}=await supabase.from('config_values').insert({kind,code:String(fd.get('code')).trim(),label:String(fd.get('label')).trim(),sort_order:rows.length*10,active:true})
  if(error){notify(error.message,'error');return}
  e.currentTarget.reset();notify('Valeur de configuration ajoutée.');await qc.invalidateQueries({queryKey:['config']})
 }
 const edit=async(x:any)=>{
  const label=prompt('Libellé',x.label);if(!label)return
  const {error}=await supabase.from('config_values').update({label}).eq('id',x.id)
  if(error){notify(error.message,'error');return}
  notify('Configuration modifiée.');await qc.invalidateQueries({queryKey:['config']})
 }
 const toggle=async(x:any)=>{
  const {error}=await supabase.from('config_values').update({active:!x.active}).eq('id',x.id)
  if(error){notify(error.message,'error');return}
  notify(x.active?'Valeur désactivée.':'Valeur activée.');await qc.invalidateQueries({queryKey:['config']})
 }

 const addDistribution=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  const fd=new FormData(e.currentTarget)
  const email=String(fd.get('email')||'').trim().toLowerCase()
  const name=String(fd.get('name')||'').trim()||null
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){notify('Adresse e-mail invalide.','error');return}
  const {error}=await supabase.from('notification_distribution_recipients').insert({name,email,active:true,sort_order:distribution.length*10})
  if(error){notify(error.message,'error');return}
  e.currentTarget.reset();notify('Destinataire ajouté à la liste de distribution.');await qc.invalidateQueries({queryKey:['notification-distribution']})
 }
 const toggleDistribution=async(x:any)=>{
  const {error}=await supabase.from('notification_distribution_recipients').update({active:!x.active,updated_at:new Date().toISOString()}).eq('id',x.id)
  if(error){notify(error.message,'error');return}
  notify(x.active?'Destinataire désactivé.':'Destinataire activé.');await qc.invalidateQueries({queryKey:['notification-distribution']})
 }
 const removeDistribution=async(x:any)=>{
  if(!confirm('Supprimer '+x.email+' de la liste de distribution ?'))return
  const {error}=await supabase.from('notification_distribution_recipients').delete().eq('id',x.id)
  if(error){notify(error.message,'error');return}
  notify('Destinataire supprimé.');await qc.invalidateQueries({queryKey:['notification-distribution']})
 }

 const backup=async()=>{
  try{
   setBackupBusy(true);notify('Préparation de la sauvegarde complète…','info')
   await runCompleteBusinessBackup()
   await qc.invalidateQueries({queryKey:['backup-status']})
   notify('Sauvegarde BDD complète Excel téléchargée.')
  }catch(e:any){notify('Erreur sauvegarde : '+(e?.message||'échec'),'error')}
  finally{setBackupBusy(false)}
 }

 const restore=async(file:File)=>{
  if(!confirm('Importer '+file.name+' ?\n\nMode sécurisé : les lignes portant les mêmes ID seront mises à jour ou recréées. Aucune table ne sera vidée automatiquement.'))return
  try{
   setImportBusy(true);setImportProgress('Lecture de la sauvegarde…');notify('Import de la sauvegarde en cours…','info')
   const counts=await importCompleteBusinessDatabase(file,p=>setImportProgress(p.message+' ('+p.tableIndex+'/'+p.tableTotal+')'))
   setImportProgress('Import terminé')
   await qc.invalidateQueries()
   notify('Sauvegarde réimportée : '+Object.keys(counts).length+' table(s) traitée(s).')
  }catch(e:any){
   setImportProgress('')
   notify('Erreur import BDD : '+(e?.message||'échec'),'error')
  }finally{
   setImportBusy(false)
   if(importRef.current)importRef.current.value=''
  }
 }

 return <div className="page config-page">
  <header className="page-head"><div><h1>Configuration</h1><p>Codes métier, notifications Outlook et sauvegarde.</p></div></header>

  <div className="grid two">
   <section className="card">
    <div className="module-tabs">{kinds.map(k=><button key={k[0]} className={kind===k[0]?'primary':'ghost'} onClick={()=>setKind(k[0])}>{k[1]}</button>)}</div>
    <div className="table-wrap desktop-only"><table><thead><tr><th>Code</th><th>Libellé</th><th>Actif</th><th></th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.id}><td><code>{x.code}</code></td><td>{x.label}</td><td><span className={'badge '+(x.active?'green':'red')}>{x.active?'Oui':'Non'}</span></td><td><div className="actions"><button className="ghost small" onClick={()=>void edit(x)}>Modifier</button><button className="ghost small" onClick={()=>void toggle(x)}>{x.active?'Désactiver':'Activer'}</button></div></td></tr>)}</tbody></table></div>
    <div className="module-mobile-list mobile-only">{rows.map((x:any)=><article className="module-mobile-card" key={x.id}><div className="module-mobile-head"><div><code>{x.code}</code><b>{x.label}</b></div><span className={'badge '+(x.active?'green':'red')}>{x.active?'Actif':'Inactif'}</span></div><div className="module-mobile-actions"><button className="ghost small" onClick={()=>void edit(x)}>Modifier</button><button className="ghost small" onClick={()=>void toggle(x)}>{x.active?'Désactiver':'Activer'}</button></div></article>)}</div>
   </section>

   <section className="card">
    <h3 className="section-title">Ajouter</h3>
    <form className="form-grid" onSubmit={add}><label>Code stable<input name="code" required placeholder="ex: network"/></label><label>Libellé<input name="label" required placeholder="ex: Réseau"/></label><button className="primary full">Ajouter</button></form>
    <p className="muted">Le code ne doit pas changer après utilisation. Le libellé peut évoluer sans casser les règles métier.</p>
   </section>
  </div>

  <section className="card distribution-card">
   <div className="module-filter-title"><Mail size={17}/><b>Liste de distribution Outlook</b><span>{distribution.filter((x:any)=>x.active).length} actif(s)</span></div>
   <p className="muted">Ces adresses reçoivent les notifications de création, mise à jour et clôture. Les contacts ajoutés au ticket viennent en complément.</p>
   <form className="distribution-add-form" onSubmit={addDistribution}>
    <label>Nom<input name="name" placeholder="ex: Exploitation / Client"/></label>
    <label>E-mail<input name="email" type="email" required placeholder="support-client@entreprise.fr"/></label>
    <button className="primary"><Plus size={15}/> Ajouter</button>
   </form>
   <div className="distribution-list">
    {distribution.length===0&&<span className="muted">Aucun destinataire global configuré.</span>}
    {distribution.map((x:any)=><div className="distribution-row" key={x.id}><div><b>{x.name||'Destinataire'}</b><small>{x.email}</small></div><span className={'badge '+(x.active?'green':'red')}>{x.active?'Actif':'Inactif'}</span><div className="actions"><button className="ghost small" onClick={()=>void toggleDistribution(x)}>{x.active?'Désactiver':'Activer'}</button><button className="danger small" onClick={()=>void removeDistribution(x)}><Trash2 size={13}/></button></div></div>)}
   </div>
  </section>

  <section className="card backup-card">
   <div className="backup-head">
    <div><DatabaseBackup size={19}/><div><h3 className="section-title">Sauvegarde & restauration BDD Excel</h3><p className="muted">Export complet des tables métier avec ID, relations, colonnes et ordre de restauration. L’import fonctionne en mode sécurisé par upsert : il ne vide pas automatiquement la production. Les mots de passe Auth et secrets serveur restent exclus.</p></div></div>
    <div className="backup-actions">
     <button className="secondary" disabled={backupBusy||importBusy} onClick={()=>void backup()}><Download size={15}/>{backupBusy?' Préparation…':' Exporter toute la BDD (.xlsx)'}</button>
     <button className="ghost" disabled={backupBusy||importBusy} onClick={()=>importRef.current?.click()}><Upload size={15}/>{importBusy?' Import…':' Importer une sauvegarde (.xlsx)'}</button>
     <input ref={importRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)void restore(f)}}/>
    </div>
   </div>
   {importProgress&&<div className="backup-import-progress">{importProgress}</div>}
  </section>
 </div>
}
