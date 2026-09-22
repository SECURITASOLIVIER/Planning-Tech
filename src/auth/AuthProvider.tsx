import { createContext,useContext,useEffect,useMemo,useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile,Role } from '../lib/types'

type AuthValue={
 session:Session|null; profile:Profile|null; loading:boolean;
 signIn:(email:string,password:string,expected?:Role)=>Promise<void>;
 signOut:()=>Promise<void>; refreshProfile:()=>Promise<void>;
}
const AuthContext=createContext<AuthValue|null>(null)

export function AuthProvider({children}:{children:React.ReactNode}){
 const [session,setSession]=useState<Session|null>(null)
 const [profile,setProfile]=useState<Profile|null>(null)
 const [loading,setLoading]=useState(true)

 const loadProfile=async(s:Session|null)=>{
  setSession(s)
  if(!s){setProfile(null);setLoading(false);return}
  const {data,error}=await supabase.from('profiles').select('*').eq('id',s.user.id).single()
  if(error||!data){setProfile(null);setLoading(false);return}
  setProfile(data as Profile)
  try{await supabase.rpc('record_login')}catch{}
  setLoading(false)
 }

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>loadProfile(data.session))
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{void loadProfile(s)})
  return()=>subscription.unsubscribe()
 },[])

 const signIn=async(email:string,password:string,expected?:Role)=>{
  setLoading(true)
  const {data,error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
  if(error){setLoading(false);throw error}
  const {data:p,error:pe}=await supabase.from('profiles').select('*').eq('id',data.user.id).single()
  if(pe||!p){await supabase.auth.signOut();setLoading(false);throw new Error('Profil applicatif introuvable')}
  const prof=p as Profile
  if(!prof.active){await supabase.auth.signOut();setLoading(false);throw new Error('Compte désactivé')}
  if(expected&&prof.role!==expected){await supabase.auth.signOut();setLoading(false);throw new Error(expected==='manager'?'Ce compte n’est pas Manager':'Ce compte n’est pas Technicien')}
  setSession(data.session);setProfile(prof);setLoading(false)
 }

 const signOut=async()=>{await supabase.auth.signOut();setProfile(null);setSession(null)}
 const refreshProfile=async()=>{if(session)await loadProfile(session)}
 const value=useMemo(()=>({session,profile,loading,signIn,signOut,refreshProfile}),[session,profile,loading])
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){const v=useContext(AuthContext);if(!v)throw new Error('AuthProvider manquant');return v}
