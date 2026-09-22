import { createClient } from '@supabase/supabase-js'

const url=import.meta.env.VITE_SUPABASE_URL || 'https://ilxdqvbcvcwfklvkyfoj.supabase.co'
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_7f0bDxce4zdPCr5_4go4Wg_S6wlEPFY'

export const supabase=createClient(url,key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
})
