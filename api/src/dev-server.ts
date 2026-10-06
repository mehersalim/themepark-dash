// Local API for development (no Azure tools needed): npm run dev  ->  http://localhost:7071/api/parks
import { createServer } from 'node:http';
import { getPool } from './db';
import { route } from './router';

const PORT = Number(process.env.PORT ?? 7071);

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method !== 'GET' || !url.pathname.startsWith('/api/')) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const result = await route(getPool(), url.pathname.slice('/api/'.length), url.searchParams);
    res.writeHead(result.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(result.body, null, 2));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Internal server error' }));
  }
}).listen(PORT, () => console.log(`Dev API on http://localhost:${PORT}/api/parks`));
