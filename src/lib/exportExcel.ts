import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export async function exportManagerWorkbook(from:string,to:string){
 const [tickets,comments,profiles,clients,inventory,movements,communications,audit,kpi]=await Promise.all([
  supabase.from('tickets').select('*').order('created_at'),
  supabase.from('ticket_comments').select('*').order('created_at'),
  supabase.from('profiles').select('*').order('display_name'),
  supabase.from('customers').select('*').order('name'),
  supabase.from('inventory_items').select('*').order('category').order('model'),
  supabase.from('inventory_movements').select('*').order('created_at'),
  supabase.from('communication_templates').select('*').order('theme').order('sort_order'),
  supabase.from('audit_events').select('*').order('created_at'),
  supabase.rpc('kpi_dashboard',{p_from:from,p_to:to})
 ])
 for(const q of [tickets,comments,profiles,clients,inventory,movements,communications,audit]) if(q.error) throw q.error
 if(kpi.error)throw kpi.error
 const wb=XLSX.utils.book_new()
 const add=(name:string,rows:unknown[])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows as any[]),name.slice(0,31))
 const allProfiles=profiles.data||[]
 add('Tickets',tickets.data||[])
 add('Commentaires',comments.data||[])
 add('Techniciens',allProfiles.filter((p:any)=>p.role==='technician'))
 add('Managers',allProfiles.filter((p:any)=>p.role==='manager'))
 add('Clients',clients.data||[])
 add('Planning',(tickets.data||[]).filter((t:any)=>t.planned_start).map((t:any)=>({ticket:t.ticket_number,titre:t.subject,technicien:t.assigned_to,debut:t.planned_start,fin:t.planned_end,statut:t.status})))
 add('Inventaire',inventory.data||[])
 add('Mouvements stock',movements.data||[])
 add('Communications',communications.data||[])
 add('Incidents parents',(tickets.data||[]).filter((t:any)=>t.parent_incident).map((t:any)=>({ticket:t.ticket_number,parent:t.parent_incident,incident_general:t.general_incident_label})))
 add('Historique',audit.data||[])
 add('KPI',[{du:from,au:to,...((kpi.data as any)?.summary||{})}])
 XLSX.writeFile(wb,'PlanningSecuritas_'+from+'_'+to+'.xlsx')
}
