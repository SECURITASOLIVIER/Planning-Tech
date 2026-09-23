import { useEffect,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { AlertTriangle,DatabaseBackup,Download } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { runCompleteBusinessBackup } from '../lib/exportDatabase'
import { notify } from '../lib/notify'

const SIX_HOURS=6*60*60*1000
const SNOOZE_MS=60*60*1000
const SNOOZE_KEY='planning-backup-reminder-snooze-until'

export function BackupReminder(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()
 const [now,setNow]=useState(Date.now())
 const [busy,setBusy]=useState(false)
 const [snoozedUntil,setSnoozedUntil]=useState(()=>Number(sessionStorage.getItem(SNOOZE_KEY)||0))

 const {data:lastExport,isLoading}=useQuery({
  queryKey:['backup-status'],
  enabled:manager,
  refetchInterval:60_000,
  queryFn:async()=>{
   const {data,error}=await supabase
    .from('audit_events')
    .select('id,created_at')
    .eq('action','database_business_backup_exported')
    .order('created_at',{ascending:false})
    .limit(1)
   if(error)throw error
   return data?.[0]||null
  }
 })

 useEffect(()=>{
  if(!manager)return
  const id=window.setInterval(()=>setNow(Date.now()),60_000)
  return()=>window.clearInterval(id)
 },[manager])

 if(!manager||isLoading)return null
 const lastTime=lastExport?.created_at?new Date(lastExport.created_at).getTime():0
 const overdue=!lastTime||now-lastTime>=SIX_HOURS
 if(!overdue||now<snoozedUntil)return null

 const ageText=lastTime
  ? Math.max(6,Math.floor((now-lastTime)/(60*60*1000)))+' h'
  : 'jamais'

 const snooze=()=>{
  const until=Date.now()+SNOOZE_MS
  sessionStorage.setItem(SNOOZE_KEY,String(until))
  setSnoozedUntil(until)
 }

 const backup=async()=>{
  try{
   setBusy(true)
   notify('Préparation de la sauvegarde complète…','info')
   await runCompleteBusinessBackup()
   sessionStorage.removeItem(SNOOZE_KEY)
   setSnoozedUntil(0)
   await qc.invalidateQueries({queryKey:['backup-status']})
   notify('Sauvegarde BDD complète Excel téléchargée.')
  }catch(e:any){
   notify('Erreur sauvegarde : '+(e?.message||'échec'),'error')
  }finally{setBusy(false)}
 }

 return <div className="drawer-backdrop notification-backdrop backup-reminder-backdrop">
  <section className="notification-dialog backup-reminder-dialog">
   <div className="notification-dialog-head"><AlertTriangle size={22}/><div><small>Sauvegarde BDD</small><h2>Export complet à effectuer</h2></div></div>
   <p className="notification-question">La dernière sauvegarde complète date de {ageText}. Le seuil configuré est de 6 heures.</p>
   <div className="backup-reminder-info"><DatabaseBackup size={18}/><span>Le fichier XLSX contient les tables métier, leurs relations et l’ordre de restauration.</span></div>
   <div className="notification-actions backup-reminder-actions">
    <button className="ghost" onClick={snooze}>Me le rappeler dans 1 h</button>
    <button className="secondary" disabled={busy} onClick={()=>void backup()}><Download size={15}/>{busy?' Préparation…':' Exporter maintenant'}</button>
   </div>
  </section>
 </div>
}
