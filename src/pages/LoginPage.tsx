import { FormEvent,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck,UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import type { Role } from '../lib/types'

export function LoginPage(){
 const {signIn}=useAuth();const navigate=useNavigate()
 const [role,setRole]=useState<Role>('manager')
 const [email,setEmail]=useState('olivier.marchegay@securitas.fr')
 const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const select=(r:Role)=>{setRole(r);setEmail(r==='manager'?'olivier.marchegay@securitas.fr':'');setPassword('');setError('')}
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await signIn(email,password,role);navigate('/')}catch(x){setError(x instanceof Error?x.message:'Connexion impossible')}finally{setBusy(false)}}
 return <div className="login-wrap"><section className="login-card">
  <div className="login-brand"><span>● ● ●</span><div><h1>Super Support IT</h1><p>Planning • ITSM • Inventaire • Clients</p></div></div>
  <div className="role-switch">
   <button type="button" className={role==='manager'?'active':''} onClick={()=>select('manager')}><ShieldCheck/>Manager</button>
   <button type="button" className={role==='technician'?'active':''} onClick={()=>select('technician')}><UserRound/>Technicien</button>
  </div>
  <form onSubmit={submit}>
   <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   {error&&<div className="alert error">{error}</div>}
   <button className="primary" disabled={busy}>{busy?'Connexion…':'Entrer en '+(role==='manager'?'Manager':'Technicien')}</button>
  </form>
 </section></div>
}
