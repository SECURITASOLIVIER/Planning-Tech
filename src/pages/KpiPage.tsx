import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { presetRange } from '../lib/dateRange'

export function KpiPage(){
 const initial=presetRange('month');const [from,setFrom]=useState(initial.from),[to,setTo]=useState(initial.to)
 const {data,isFetching}=useQuery({queryKey:['kpi',from,to],queryFn:async()=>{const {data,error}=await supabase.rpc('kpi_dashboard',{p_from:from,p_to:to});if(error)throw error;return data as any}})
 const s=data?.summary||{},timeline=data?.timeline||[],byTech=data?.by_technician||[]
 const preset=(p:'today'|'7d'|'month'|'year')=>{const r=presetRange(p);setFrom(r.from);setTo(r.to)}
 return <div className="page"><header className="page-head"><div><h1>KPI & activité</h1><p>Analyse par jour, mois, année ou période personnalisée.</p></div><div className="actions"><button className="ghost" onClick={()=>preset('today')}>Aujourd’hui</button><button className="ghost" onClick={()=>preset('7d')}>7 jours</button><button className="ghost" onClick={()=>preset('month')}>Mois</button><button className="ghost" onClick={()=>preset('year')}>Année</button></div></header>
 <section className="card toolbar"><label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{isFetching&&<span className="muted">Actualisation…</span>}</section>
 <section className="grid four"><div className="kpi"><b>{s.created??0}</b><span>Créés</span></div><div className="kpi good"><b>{s.closed??0}</b><span>Clôturés</span></div><div className="kpi"><b>{s.backlog??0}</b><span>Backlog</span></div><div className="kpi danger"><b>{s.blocking??0}</b><span>Bloquants</span></div><div className="kpi"><b>{s.avg_resolution_hours??0} h</b><span>Délai moyen résolution</span></div><div className="kpi"><b>{s.avg_takeover_hours??0} h</b><span>Délai prise en charge</span></div><div className="kpi"><b>{s.reopened??0}</b><span>Réouverts</span></div><div className="kpi"><b>{s.closure_rate??0}%</b><span>Taux de clôture</span></div></section>
 <section className="grid two"><div className="card"><h3>Activité dans le temps</h3><div style={{height:300}}><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="period"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="created" name="Créés"/><Line type="monotone" dataKey="closed" name="Clôturés"/></LineChart></ResponsiveContainer></div></div>
 <div className="card"><h3>Charge par technicien</h3><div style={{height:300}}><ResponsiveContainer width="100%" height="100%"><BarChart data={byTech}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="total" name="Tickets"/><Bar dataKey="closed" name="Clôturés"/></BarChart></ResponsiveContainer></div></div></section>
 </div>
}
