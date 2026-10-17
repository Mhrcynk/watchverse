/** GET-only requests share in-flight work. Failures never poison the next attempt. */
export function createJsonClient(fetcher: typeof fetch = fetch, timeoutMs = 12000, retryDelayMs = 400) {
  const pending = new Map<string,Promise<unknown>>();
  async function attempt(url:string) {
    for(let n=0;n<2;n++) {
      const controller=new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async()=>{const response=await fetcher(url,{signal:controller.signal});
            if(!response.ok)throw Object.assign(new Error(`http ${response.status}`),{status:response.status});
            return response.json();})(),
          new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('İstek zaman aşımına uğradı.'));},timeoutMs);}),
        ]);
      } catch(error) {
        const status=(error as {status?:number})?.status;
        if(n===1 || (status && status!==429 && status<500))throw error;
      } finally {if(timer)clearTimeout(timer);}
      await new Promise(resolve=>setTimeout(resolve,retryDelayMs));
    }
    throw new Error('İstek tamamlanamadı.');
  }
  return function getJson<T>(url:string):Promise<T> {
    const running=pending.get(url);if(running)return running as Promise<T>;
    const work=attempt(url).finally(()=>{pending.delete(url);});
    pending.set(url,work);return work as Promise<T>;
  };
}
export const getJson=createJsonClient();
