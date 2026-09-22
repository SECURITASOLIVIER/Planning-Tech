export type NoticeKind='success'|'error'|'info'

export function notify(message:string,kind:NoticeKind='success'){
 window.dispatchEvent(new CustomEvent('planning-notice',{detail:{message,kind,id:Date.now()}}))
}
