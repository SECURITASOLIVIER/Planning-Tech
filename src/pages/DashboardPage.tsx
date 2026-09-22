import { useQuery } from '@tanstack/react-query'
import { startOfMonth,format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export function DashboardPage(){
 const {profile}=useAuth()
 const from=format(startOfMonth(new Date()),'yyyy-MM-dd'),to=format(new Date(),'yyyy-MM-dd')
 const {data}=useQuery({queryKey:['dashboard',from,to],queryFn:async()=>{
  const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any
 }})
 const s=data?.summary||{}
 return <div className="page"><header className="page-head"><div><h1>Bonjour {profile?.display_name}</h1><p>Vue opérationnelle du support.</p></div></header>
 <section className="grid four">
  <div className="kpi"><b>{s.created??0}</b><span>Tickets créés ce mois</span></div>
  <div className="kpi good"><b>{s.closed??0}</b><span>Clôturés</span></div>
  <div className="kpi"><b>{s.in_progress??0}</b><span>En cours</span></div>
  <div className="kpi danger"><b>{s.blocking??0}</b><span>Bloquants</span></div>
 </section>
 <section className="grid two"><div className="card"><h3>Backlog</h3><p className="muted">Tickets encore ouverts</p><div className="kpi"><b>{s.backlog??0}</b><span>tickets</span></div></div>
 <div className="card"><h3>Stock</h3><p className="muted">Alertes inventaire actives</p><div className="kpi"><b>{data?.inventory?.low_stock??0}</b><span>références en stock faible / rupture</span></div></div></section>
 </div>
}
