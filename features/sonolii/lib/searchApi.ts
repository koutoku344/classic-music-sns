import { API_BASE } from './repertoireApi';
export type SearchUser = {user_id:string;display_name:string;instruments:string[];region:string|null};
export type SearchUserPage = {users:SearchUser[];nextCursor:string|null};
export async function searchUsers(options:{keyword?:string;instrument?:string;region?:string;cursor?:string|null},getToken:()=>Promise<string|null>):Promise<SearchUserPage>{
 const qs=new URLSearchParams();
 if(options.keyword?.trim())qs.set('q',options.keyword.trim());
 if(options.instrument&&options.instrument!=='all')qs.set('instrument',options.instrument);
 if(options.region&&options.region!=='all')qs.set('region',options.region);
 if(options.cursor)qs.set('cursor',options.cursor);
 const token=await getToken();
 const r=await fetch(API_BASE+'/users/search?'+qs,{cache:'no-store',headers:token?{Authorization:'Bearer '+token}:{}});
 if(!r.ok)throw new Error('ユーザー検索に失敗しました（HTTP '+r.status+'）');
 return await r.json() as SearchUserPage;
}
