import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const host='127.0.0.1',port=4174;
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const server=http.createServer(async(req,res)=>{
  try{
    const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
    if(!file.startsWith(root)){res.writeHead(404);res.end('Not found');return;}
    const body=await readFile(file),etag='"'+createHash('sha256').update(body).digest('hex').slice(0,16)+'"';
    const type={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain'}[path.extname(file)]||'application/octet-stream';
    const headers={'content-type':type+'; charset=utf-8','cache-control':route.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache',etag};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
    res.writeHead(200,headers);res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,host,()=>console.log(`Local: http://${host}:${port}/`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
