import { useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Profile,Ticket } from '../lib/types'

export function PlanningPage(){
 const {profile}=useAuth();const qc=useQueryClient();const [tech,setTech]=useState('')
 const {data:tickets=[]}=useQuery({queryKey:['tickets'],queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('planned_start');if(error)throw error;return data as Ticket[]}})
 const {data:profiles=[]}=useQuery({queryKey:['profiles'],queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').eq('active',true).order('display_name');if(error)throw error;return data as Profile[]}})
 const shown=tech?tickets.filter(t=>t.assigned_to===tech):tickets
 const events=shown.filter(t=>t.planned_start).map(t=>({id:t.id,title:t.ticket_number+' • '+t.subject,start:t.planned_start!,end:t.planned_end||undefined,extendedProps:{status:t.status,tech:t.assigned_to}}))
 const move=async(info:any)=>{const {error}=await supabase.from('tickets').update({planned_start:info.event.start?.toISOString(),planned_end:info.event.end?.toISOString()||null}).eq('id',info.event.id);if(error){info.revert();alert(error.message)}else await qc.invalidateQueries({queryKey:['tickets']})}
 return <div className="page"><header className="page-head"><div><h1>Planning</h1><p>Jour, 3 jours et semaine. Glisser-déposer et redimensionnement.</p></div>
 {profile?.role==='manager'&&<label>Technicien<select value={tech} onChange={e=>setTech(e.target.value)}><option value="">Toute l’équipe</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>}</header>
 <FullCalendar plugins={[timeGridPlugin,dayGridPlugin,interactionPlugin]} locale={frLocale} initialView="timeGridWeek" firstDay={1} allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="20:00:00" nowIndicator height="auto"
  headerToolbar={{left:'prev,next today',center:'title',right:'timeGridDay,timeGridThreeDay,timeGridWeek,dayGridMonth'}}
  views={{timeGridThreeDay:{type:'timeGrid',duration:{days:3},buttonText:'3 jours'}}}
  editable selectable events={events} eventDrop={move} eventResize={move}/>
 </div>
}
