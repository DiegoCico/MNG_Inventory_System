import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Express API!' });
});

// Optional: friendly root message
app.get('/', (_req, res) => {
  res.type('text/plain').send('API up. Try GET /api/hello');
});

// Only start the server if not running in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
