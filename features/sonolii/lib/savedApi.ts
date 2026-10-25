import { API_BASE } from './repertoireApi';
import type { TokenGetter } from './mediaApi';
export type SavedKind='post'|'recruitment';
export type SavedItem={item_type:SavedKind;item_id:string;title:string|null;owner_id:string;created_at:string};
async function call(path:string,getToken:TokenGetter,method='GET'){
 const token=await getToken();
 if(!token)throw Error('ログインが必要です。');
 const r=await fetch(API_BASE+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token}});
 if(!r.ok)throw Error('保存情報を取得できませんでした。');
 return r;
}
export async function listSaved(getToken:TokenGetter):Promise<SavedItem[]>{
 const response=await call('/me/saved',getToken);
 return (await response.json() as {items:SavedItem[]}).items;
}
export async function getSaved(kind:SavedKind,id:string,getToken:TokenGetter):Promise<boolean>{
 const response=await call('/me/saved/'+kind+'/'+encodeURIComponent(id),getToken);
 return (await response.json() as {saved:boolean}).saved;
}
export async function setSaved(kind:SavedKind,id:string,value:boolean,getToken:TokenGetter){
 await call('/me/saved/'+kind+'/'+encodeURIComponent(id),getToken,value?'PUT':'DELETE');
}
