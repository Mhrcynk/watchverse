import { checkpoint } from './checkpoint';
import { sb } from './supabase';
/** Capture the intended account before async work; the server independently verifies it. */
export async function accountRpc<T>(fn: string,args:Record<string,unknown>={}, expected?:string):Promise<T> {
 const client=sb();if(!client)throw new Error('Giriş gerekli.');
 const {data:{session},error:sessionError}=await client.auth.getSession();
 if(sessionError)throw sessionError;
 if(!session || (expected && expected!==session.user.id))throw new Error('Oturum değişti.');
 const owner=(await checkpoint.load()).meta.uid;
 if(owner && owner!==session.user.id)throw new Error('Hesap eşitlemesi tamamlanmalı.');
 const {data,error}=await client.rpc(fn,{...args,p_owner:session.user.id});
 if(error)throw error;
 const {data:{session:current}}=await client.auth.getSession();
 if(current?.access_token!==session.access_token)throw new Error('Oturum değişti.');
 return data as T;
}
