import express from 'express';
import cors, { type CorsOptions } from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext } from './routers/trpc';
import { helloRouter } from './routers/hello';

const app = express();
const port = Number(process.env.PORT ?? 3001);

// Explicit allowlist from CDK
const exactOrigins: Set<string> = new Set(JSON.parse(process.env.ALLOWED_ORIGINS ?? '[]'));
const patternRegexes = (process.env.ALLOWED_ORIGIN_PATTERNS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((p) => new RegExp(p));

// derive this API’s own host via forwarding headers
const corsDelegate = (req: express.Request, cb: (e: Error | null, o?: CorsOptions) => void) => {
  const origin = req.header('Origin') ?? undefined;

  const fwdHost = req.header('x-forwarded-host');
  const fwdProto = req.header('x-forwarded-proto') ?? 'https';
  const selfOrigin = fwdHost ? `${fwdProto}://${fwdHost}` : undefined;

  const allowSet = new Set(exactOrigins);
  if (selfOrigin) allowSet.add(selfOrigin);

  const allowed =
    !origin || allowSet.has(origin) || patternRegexes.some((rx) => origin && rx.test(origin));

  cb(null, { origin: allowed, credentials: true });
};

app.options('*', cors(corsDelegate));
app.use(cors(corsDelegate));

// TODO: ONCE YOU MAKE A ROUTER MAP IT HERE FOR LOCAL DEV
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/hello', trpcExpress.createExpressMiddleware({ router: helloRouter, createContext }));
app.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext }));

app.get('/', (_req, res) => res.type('text/plain').send('API up at /trpc'));

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

export default app;
