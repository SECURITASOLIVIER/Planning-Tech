import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { presetRange } from '../lib/dateRange'

export function KpiPage(){
 const initial=presetRange('month')
 const [from,setFrom]=useState(initial.from)
 const [to,setTo]=useState(initial.to)

 const {data,isFetching}=useQuery({
  queryKey:['kpi',from,to],
  queryFn:async()=>{
   const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to})
   if(error)throw error
   return data as any
  }
 })

 const s=data?.summary||{}
 const timeline=data?.timeline||[]
 const byTech=data?.by_technician||[]
 const preset=(p:'today'|'7d'|'month'|'year')=>{const r=presetRange(p);setFrom(r.from);setTo(r.to)}

 const exportExcel=()=>{
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{
   du:from,au:to,
   crees:s.created||0,
   nouveaux:s.new_count||0,
   ouverts:s.backlog||0,
   en_cours:s.in_progress||0,
   en_attente:s.waiting||0,
   bloquants:s.blocking||0,
   clotures:s.closed||0,
   reouverts:s.reopened||0,
   taux_cloture:s.closure_rate||0,
   delai_moyen_resolution_h:s.avg_resolution_hours||0,
   delai_prise_en_charge_h:s.avg_takeover_hours||0
  }]),'Synthese KPI')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(byTech),'KPI Techniciens')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(timeline),'Evolution')
  XLSX.writeFile(wb,'PlanningSecuritas_KPI_'+from+'_'+to+'.xlsx')
 }

 return <div className="page kpi-page">
  <header className="page-head">
   <div><h1>KPI Tickets & Techniciens</h1><p>Tickets ouverts, en cours, en attente, clôturés et charge par technicien.</p></div>
   <div className="actions">
    <div className="module-tabs"><button className="ghost" onClick={()=>preset('today')}>Aujourd’hui</button><button className="ghost" onClick={()=>preset('7d')}>7 jours</button><button className="ghost" onClick={()=>preset('month')}>Mois</button><button className="ghost" onClick={()=>preset('year')}>Année</button></div>
    <button className="secondary page-primary-action" onClick={exportExcel}><Download size={16}/> Export Excel</button>
   </div>
  </header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><b>Période</b>{isFetching&&<span>Actualisation…</span>}</div>
   <div className="module-filter-grid">
    <label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   </div>
  </section>

  <section className="grid four kpi-grid">
   <div className="kpi"><b>{s.backlog??0}</b><span>Tickets ouverts</span></div>
   <div className="kpi"><b>{s.new_count??0}</b><span>Nouveaux</span></div>
   <div className="kpi"><b>{s.in_progress??0}</b><span>En cours</span></div>
   <div className="kpi"><b>{s.waiting??0}</b><span>En attente</span></div>
   <div className="kpi good"><b>{s.closed??0}</b><span>Clôturés période</span></div>
   <div className="kpi danger"><b>{s.blocking??0}</b><span>Bloquants</span></div>
   <div className="kpi"><b>{s.reopened??0}</b><span>Réouverts</span></div>
   <div className="kpi"><b>{s.closure_rate??0}%</b><span>Taux de clôture</span></div>
  </section>

  <section className="grid two chart-grid">
   <div className="card"><h3 className="section-title">Créés / clôturés dans le temps</h3><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="period"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="created" name="Créés"/><Line type="monotone" dataKey="closed" name="Clôturés"/></LineChart></ResponsiveContainer></div></div>
   <div className="card"><h3 className="section-title">Charge par technicien</h3><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={byTech}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="open" name="Ouverts"/><Bar dataKey="in_progress" name="En cours"/><Bar dataKey="closed" name="Clôturés"/></BarChart></ResponsiveContainer></div></div>
  </section>

  <section className="card">
   <h3 className="section-title">KPI par technicien</h3>
   <div className="table-wrap desktop-only"><table><thead><tr><th>Technicien</th><th>Ouverts</th><th>Nouveaux</th><th>En cours</th><th>En attente</th><th>Clôturés</th><th>Bloquants</th></tr></thead><tbody>{byTech.map((t:any)=><tr key={t.id}><td><b>{t.name}</b></td><td>{t.open}</td><td>{t.new_count}</td><td>{t.in_progress}</td><td>{t.waiting}</td><td>{t.closed}</td><td>{t.blocking}</td></tr>)}</tbody></table></div>
   <div className="module-mobile-list">{byTech.map((t:any)=><article className="module-mobile-card" key={t.id}><div className="module-mobile-head"><div><b>{t.name}</b><small>{t.total} ticket(s) créés sur la période</small></div><span className="badge">{t.open} ouverts</span></div><div className="module-mobile-meta"><div><span>Nouveaux</span><b>{t.new_count}</b></div><div><span>En cours</span><b>{t.in_progress}</b></div><div><span>En attente</span><b>{t.waiting}</b></div><div><span>Clôturés</span><b>{t.closed}</b></div></div></article>)}</div>
  </section>
 </div>
}
