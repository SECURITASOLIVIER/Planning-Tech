import { NavLink,Outlet } from 'react-router-dom'
import { Activity,Boxes,CalendarDays,ClipboardList,FileClock,Gauge,LogOut,Settings,Users,Building2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

const item=(to:string,label:string,Icon:React.ComponentType<{size?:number}>)=>({to,label,Icon})

export function AppShell(){
 const {profile,signOut}=useAuth()
 const manager=profile?.role==='manager'
 const nav=[
  item('/','Dashboard',Gauge),
  item('/planning','Planning',CalendarDays),
  item('/tickets','Tickets',ClipboardList),
  ...(manager?[item('/clients','Clients',Building2),item('/users','Utilisateurs',Users),item('/inventory','Inventaire',Boxes),item('/kpi','KPI',Activity),item('/configuration','Configuration',Settings),item('/audit','Audit',FileClock)]:[item('/inventory','Matériel',Boxes)])
 ]
 return <div className="app-shell">
  <aside className="sidebar">
   <div className="brand"><span className="brand-dots">● ● ●</span><b>SUPER SUPPORT IT</b><small>Planning / ITSM</small></div>
   <nav>{nav.map(({to,label,Icon})=><NavLink key={to} to={to} end={to==='/' }><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
   <div className="sidebar-user"><b>{profile?.display_name}</b><small>{manager?'Manager':'Technicien'}</small><button onClick={()=>void signOut()}><LogOut size={16}/>Déconnexion</button></div>
  </aside>
  <main className="content"><Outlet/></main>
 </div>
}
