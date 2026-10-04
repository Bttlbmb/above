import http from 'node:http';
import {readFile} from 'node:fs/promises';
const host='127.0.0.1',port=4174;
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path!=='/'&&path!=='/index.html'){res.writeHead(404);res.end('Not found');return;}
  try{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(await readFile(new URL('../dist/index.html',import.meta.url)));}
  catch{res.writeHead(500);res.end('Preview unavailable');}
});
server.listen(port,host,()=>console.log(`Local: http://${host}:${port}/`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
