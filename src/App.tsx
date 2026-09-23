import { Navigate,Route,Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PlanningPage } from './pages/PlanningPage'
import { TicketsPage } from './pages/TicketsPage'
import { UsersPage } from './pages/UsersPage'
import { ClientsPage } from './pages/ClientsPage'
import { InventoryPage } from './pages/InventoryPage'
import { KpiPage } from './pages/KpiPage'
import { ConfigPage } from './pages/ConfigPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { CommunicationsPage } from './pages/CommunicationsPage'
import { HistoryPage } from './pages/HistoryPage'

function Guard({manager=false}:{manager?:boolean}){
 const {session,profile,loading}=useAuth()
 if(loading)return <div className="center-state">Chargement…</div>
 if(!session||!profile)return <Navigate to="/login" replace/>
 if(profile.force_password_change)return <Navigate to="/change-password" replace/>
 if(manager&&profile.role!=='manager')return <Navigate to="/" replace/>
 return <AppShell/>
}
export default function App(){
 return <Routes>
  <Route path="/login" element={<LoginPage/>}/>
  <Route path="/change-password" element={<ChangePasswordPage/>}/>
  <Route element={<Guard/>}>
   <Route index element={<DashboardPage/>}/>
   <Route path="planning" element={<PlanningPage/>}/>
   <Route path="tickets" element={<TicketsPage/>}/>
   <Route path="inventory" element={<InventoryPage/>}/>
   <Route path="communications" element={<CommunicationsPage/>}/>
   <Route path="history" element={<HistoryPage/>}/>
   <Route path="kpi" element={<KpiPage/>}/>
  </Route>
  <Route element={<Guard manager/>}>
   <Route path="users" element={<UsersPage/>}/>
   <Route path="clients" element={<ClientsPage/>}/>
   <Route path="configuration" element={<ConfigPage/>}/>
  </Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>
}
