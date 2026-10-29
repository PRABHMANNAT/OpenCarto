'use client';
import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {loadIndiaPunjabOverrides,waitForAlternateLock} from './india-punjab-scenario';
export default function AlternateWorldAccess({open,onCancel,onUnlock}:{open:boolean;onCancel:()=>void;onUnlock:()=>void}){
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef<AbortController|null>(null);
 function close(){pending.current?.abort();setPassword('');setError('');setBusy(false);onCancel();}
 async function submit(event:React.SubmitEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
  try{
   await waitForAlternateLock();if(controller.signal.aborted)return;
   const response=await fetch('/api/alternate-world',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:controller.signal});
   const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error||'The map could not be unlocked.');
   await loadIndiaPunjabOverrides();if(controller.signal.aborted)return;setPassword('');onUnlock();
  }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Could not connect. Please try again.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <Dialog open={open} onOpenChange={value=>{if(!value)close();}}><DialogContent><DialogTitle>Open alternate world map</DialogTitle><DialogDescription>Enter the password to open the complete fictional world map with United Punjab and Kashmir included in India, and Aksai Chin in Ladakh.</DialogDescription><form onSubmit={submit} className="alternate-world-access"><label className="field">Map password<input type="password" inputMode="numeric" autoComplete="off" aria-label="Alternate world map password" value={password} maxLength={64} onChange={event=>{setPassword(event.target.value);setError('');}} required/></label>{error&&<p role="alert">{error}</p>}<div className="scope-shortcuts"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary" disabled={busy||!password}>{busy?'Opening map…':'Open map'}</button></div></form></DialogContent></Dialog>;
}
