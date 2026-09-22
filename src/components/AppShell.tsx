import { NavLink,Outlet } from 'react-router-dom'
import { Activity,Boxes,CalendarDays,ClipboardList,FileClock,Gauge,LogOut,Settings,Users,Building2,MessageSquareText } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

const item=(to:string,label:string,Icon:React.ComponentType<{size?:number}>)=>({to,label,Icon})

export function AppShell(){
 const {profile,signOut}=useAuth()
 const manager=profile?.role==='manager'
 const nav=[
  item('/','Dashboard',Gauge),
  item('/planning','Planning',CalendarDays),
  item('/tickets','Tickets',ClipboardList),
  item('/communications','Communications',MessageSquareText),
  item('/history','Historique',FileClock),
  ...(manager?[
   item('/clients','Clients',Building2),
   item('/users','Utilisateurs',Users),
   item('/inventory','Inventaire',Boxes),
   item('/kpi','KPI',Activity),
   item('/configuration','Configuration',Settings),
   ]:[item('/inventory','Matériel',Boxes)])
 ]
 return <div className="workspace">
  <header className="topbar">
   <div className="top-dots"><i/><i/><i/></div>
   <div className="top-brand"><b>Planning Securitas</b><small>Planning ITSM sécurisé</small></div>
   <div className="top-spacer"/>
   <div className="top-user"><b>{profile?.display_name}</b><small>{manager?'Manager':'Technicien'}</small></div>
   <button className="top-logout" onClick={()=>void signOut()}><LogOut size={16}/> Déconnexion</button>
  </header>

  <div className="app-layout">
   <aside className="sidebar">
    <div className="nav-section-label">Workspace</div>
    <nav>{nav.map(({to,label,Icon})=><NavLink key={to} to={to} end={to==='/' }><span className="nav-icon"><Icon size={17}/></span><span>{label}</span></NavLink>)}</nav>
    <div className="nav-section-label nav-role-label">{manager?'Accès Manager':'Accès Technicien'}</div>
   </aside>
   <main className="content"><Outlet/></main>
  </div>
 </div>
}
