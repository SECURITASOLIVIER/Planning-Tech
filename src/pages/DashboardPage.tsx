import { useQuery } from '@tanstack/react-query'
import { startOfMonth,format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { exportManagerWorkbook } from '../lib/exportExcel'

export function DashboardPage(){
 const {profile}=useAuth()
 const from=format(startOfMonth(new Date()),'yyyy-MM-dd'),to=format(new Date(),'yyyy-MM-dd')
 const {data}=useQuery({queryKey:['dashboard',from,to],queryFn:async()=>{
  const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any
 }})
 const s=data?.summary||{}
 return <div className="page dashboard-page"><header className="page-head"><div><h1>Bonjour {profile?.display_name}</h1><p>Vue opérationnelle du support.</p></div></header>
 <section className="actions dashboard-actions">{profile?.role==='manager'&&<button className="secondary page-primary-action" onClick={()=>void exportManagerWorkbook(from,to)}>Exporter Excel</button>}</section>
 <section className="grid four kpi-grid">
  <div className="kpi"><b>{s.created??0}</b><span>Tickets créés ce mois</span></div>
  <div className="kpi good"><b>{s.closed??0}</b><span>Clôturés</span></div>
  <div className="kpi"><b>{s.in_progress??0}</b><span>En cours</span></div>
  <div className="kpi danger"><b>{s.blocking??0}</b><span>Bloquants</span></div>
 </section>
 <section className="grid two"><div className="card"><h3 className="section-title">Backlog</h3><p className="muted">Tickets encore ouverts</p><div className="kpi"><b>{s.backlog??0}</b><span>tickets</span></div></div>
 <div className="card"><h3 className="section-title">Stock</h3><p className="muted">Alertes inventaire actives</p><div className="kpi"><b>{data?.inventory?.low_stock??0}</b><span>références en stock faible / rupture</span></div></div></section>
 </div>
}
