import * as XLSX from 'xlsx'
import { supabase } from './supabase'

const NULL_TOKEN='__NULL__'
const JSON_PREFIX='__JSON__:'
const CHUNK_SIZE=250
const ACCEPTED_FORMATS=new Set(['planning-securitas-xlsx-backup','planning-xlsx-backup'])

export type DatabaseImportProgress={
 table:string
 tableIndex:number
 tableTotal:number
 processedRows:number
 expectedRows:number
 message:string
}

function denormalizeCell(value:unknown){
 if(value===NULL_TOKEN)return null
 if(typeof value==='string'&&value.startsWith(JSON_PREFIX)){
  const raw=value.slice(JSON_PREFIX.length)
  try{return JSON.parse(raw)}catch{throw new Error('Valeur JSON invalide dans la sauvegarde')}
 }
 return value
}

function getManifestValue(rows:unknown[][],key:string){
 const row=rows.find(r=>String(r?.[0]??'').trim().toLowerCase()===key.toLowerCase())
 return row?.[1]
}

export async function importCompleteBusinessDatabase(
 file:File,
 onProgress?:(progress:DatabaseImportProgress)=>void
){
 const bytes=await file.arrayBuffer()
 const workbook=XLSX.read(bytes,{type:'array',cellDates:false})

 const manifestSheet=workbook.Sheets['MANIFEST']
 const tablesSheet=workbook.Sheets['TABLES']
 if(!manifestSheet||!tablesSheet)throw new Error('Sauvegarde invalide : feuilles MANIFEST/TABLES absentes')

 const manifestRows=XLSX.utils.sheet_to_json(manifestSheet,{header:1,defval:'',raw:true}) as unknown[][]
 const format=String(getManifestValue(manifestRows,'format')||'')
 const formatVersion=Number(getManifestValue(manifestRows,'format_version')||0)

 if(!ACCEPTED_FORMATS.has(format))throw new Error('Ce fichier n’est pas une sauvegarde Planning reconnue')
 if(formatVersion!==2)throw new Error('Version de sauvegarde non supportée : '+formatVersion)

 const tableRows=XLSX.utils.sheet_to_json(tablesSheet,{defval:'',raw:true}) as Array<Record<string,unknown>>
 const tables=tableRows
  .map(row=>({
   restoreOrder:Number(row.restore_order||0),
   table:String(row.table_name||'').trim(),
   expectedRows:Number(row.row_count||0),
   sheetNames:String(row.sheet_names||'').split(',').map(x=>x.trim()).filter(Boolean)
  }))
  .filter(x=>x.table&&x.sheetNames.length)
  .sort((a,b)=>a.restoreOrder-b.restoreOrder)

 if(tables.length===0)throw new Error('Aucune table à restaurer dans cette sauvegarde')

 const counts:Record<string,number>=Object.create(null)

 for(const [tableIndex,meta] of tables.entries()){
  let parsedForTable=0
  counts[meta.table]=0

  for(const sheetName of meta.sheetNames){
   const sheet=workbook.Sheets[sheetName]
   if(!sheet)throw new Error(meta.table+' : feuille '+sheetName+' introuvable')

   const rawRows=XLSX.utils.sheet_to_json(sheet,{defval:NULL_TOKEN,raw:true}) as Array<Record<string,unknown>>
   parsedForTable+=rawRows.length

   for(let offset=0;offset<rawRows.length;offset+=CHUNK_SIZE){
    const rows=rawRows.slice(offset,offset+CHUNK_SIZE).map(row=>
     Object.fromEntries(Object.entries(row).map(([key,value])=>[key,denormalizeCell(value)]))
    )

    onProgress?.({
     table:meta.table,
     tableIndex:tableIndex+1,
     tableTotal:tables.length,
     processedRows:Math.min(offset+rows.length,rawRows.length),
     expectedRows:meta.expectedRows,
     message:'Import '+meta.table+'…'
    })

    const {data,error}=await supabase.functions.invoke('manager-database-restore',{
     body:{
      action:'upsert',
      format,
      format_version:formatVersion,
      table:meta.table,
      rows
     }
    })

    if(error)throw new Error(meta.table+' : '+error.message)
    if(data?.error)throw new Error(meta.table+' : '+data.error)
    counts[meta.table]+=Number(data?.processed??rows.length)
   }
  }

  if(parsedForTable!==meta.expectedRows){
   throw new Error(meta.table+' : '+parsedForTable+' ligne(s) trouvée(s), '+meta.expectedRows+' attendue(s)')
  }
 }

 onProgress?.({
  table:'Finalisation',
  tableIndex:tables.length,
  tableTotal:tables.length,
  processedRows:0,
  expectedRows:0,
  message:'Recalage des séquences et journalisation…'
 })

 const {data:finalData,error:finalError}=await supabase.functions.invoke('manager-database-restore',{
  body:{action:'finalize',counts,source_file:file.name}
 })
 if(finalError)throw new Error('Finalisation : '+finalError.message)
 if(finalData?.error)throw new Error('Finalisation : '+finalData.error)

 return counts
}
