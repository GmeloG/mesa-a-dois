import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function files(dir, prefix='') {
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const relative=prefix+entry.name;
    if(entry.isDirectory())result.push(...await files(`${dir}/${entry.name}`,relative+'/'));
    else if(!['sw.js','offline.html'].includes(entry.name))result.push(relative);
  }
  return result;
}
const entries=(await files('dist')).sort();
const hash=createHash('sha256');
for(const path of entries)hash.update(await readFile(`dist/${path}`));
const version=hash.digest('hex').slice(0,16);
const script=`// Generated from the build. Each repository has its own cache scope.
const PREFIX='mesa-a-dois:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+${JSON.stringify(version)};
const URLS=${JSON.stringify(entries)}.map(path=>new URL(path,self.registration.scope).href);
// A versão nova ativa-se de imediato; a página mostra um aviso para recarregar.
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
   const fallback=()=>caches.match(new URL('index.html',scope).href).then(r=>r||Response.error());
   event.respondWith(fetch(request,{cache:'no-store'}).then(response=>response.ok?response:fallback()).catch(fallback));return;
 }
 if(url.pathname.endsWith('/firebase-config.js')){
   event.respondWith(fetch(request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(request,clone));}return response;}).catch(()=>caches.match(request)));return;
 }
 if(URLS.includes(url.href))event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
`;
await writeFile('dist/sw.js',script);
await writeFile('dist/.nojekyll','');
console.log(`PWA ready: ${entries.length} assets, cache ${version}`);
