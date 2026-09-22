export type RangePreset='today'|'7d'|'month'|'year'|'custom'
export const isoDay=(d:Date)=>d.toISOString().slice(0,10)
export function presetRange(p:RangePreset){
 const now=new Date(), from=new Date(now), to=new Date(now)
 if(p==='7d')from.setDate(now.getDate()-6)
 if(p==='month')from.setDate(1)
 if(p==='year'){from.setMonth(0,1)}
 return {from:isoDay(from),to:isoDay(to)}
}
