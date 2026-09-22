import { supabase } from './supabase'

const BUSINESS_TABLES=[
 'profiles','config_values','materials_catalog','customers','customer_contacts',
 'tickets','ticket_comments','ticket_materials','ticket_history',
 'inventory_items','inventory_movements','inventory_allocations','inventory_assets',
 'communication_templates','technician_presence','ticket_worklogs','audit_events'
] as const

function downloadJson(data:unknown,filename:string){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url
 a.download=filename
 a.style.display='none'
 document.body.appendChild(a)
 a.click()
 setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500)
}

export async function exportCompleteBusinessDatabase(){
 const exported:Record<string,unknown[]>=Object.create(null)
 const counts:Record<string,number>=Object.create(null)
 for(const table of BUSINESS_TABLES){
  const {data,error}=await supabase.from(table).select('*')
  if(error)throw new Error(table+' : '+error.message)
  exported[table]=data||[]
  counts[table]=(data||[]).length
 }
 const payload={
  manifest:{
   format:'planning-securitas-business-backup',
   format_version:1,
   exported_at:new Date().toISOString(),
   project_ref:'ilxdqvbcvcwfklvkyfoj',
   tables:[...BUSINESS_TABLES],
   row_counts:counts,
   excludes:['auth passwords','service_role','JWT secrets','database password','Edge Function secrets']
  },
  data:exported
 }
 const stamp=new Date().toISOString().replaceAll(':','-').slice(0,19)
 downloadJson(payload,'PlanningSecuritas_Backup_Complet_'+stamp+'.json')
 return counts
}
