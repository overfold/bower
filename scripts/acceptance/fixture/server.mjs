import { createServer } from 'node:http';
const readyAt = Date.now() + Number(process.env.READY_DELAY_SECONDS || 0) * 1000;
createServer((req, res) => {
  if (req.url === '/fail' || (req.url === '/health' && Date.now() < readyAt)) {
    res.writeHead(503).end('not ready\n');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`bower-acceptance-${process.env.VERSION}\n`);
  }
}).listen(8080, '0.0.0.0');
