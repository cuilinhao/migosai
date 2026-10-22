export type AccountSnapshot<T>={owner:string|null;data:T|null;error:string;loading:boolean};
/** Account data is visible only to the owner that completed the request. */
export function accountView<T>(owner:string|null,authLoading:boolean,snapshot:AccountSnapshot<T>) {
  if(!owner)return {data:null,error:'',loading:authLoading,signedIn:false};
  if(snapshot.owner!==owner)return {data:null,error:'',loading:true,signedIn:true};
  return {data:snapshot.data,error:snapshot.error,loading:authLoading||snapshot.loading,signedIn:true};
}
