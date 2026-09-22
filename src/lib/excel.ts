import * as XLSX from 'xlsx'

export function downloadWorkbook(wb:XLSX.WorkBook,filename:string){
 const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array'})
 const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url
 a.download=filename
 a.style.display='none'
 document.body.appendChild(a)
 a.click()
 setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500)
}

export function addSheet(wb:XLSX.WorkBook,name:string,rows:unknown[]){
 const safe=rows.length?rows:[{information:'Aucune donnée pour les filtres sélectionnés'}]
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(safe as any[]),name.slice(0,31))
}

export function excelDate(value:string|null|undefined){
 return value?new Date(value).toLocaleString('fr-FR'):''
}
