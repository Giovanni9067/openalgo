import express from 'express';
import path from 'node:path';
import { apiV1Router } from './src/routes/apiV1.js';
import { webRouter } from './src/routes/web.js';

const app = express();
const PORT = Number(process.env.PORT || process.env.FLASK_PORT || 3000);
const HOST = '0.0.0.0';

app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'public')));

app.use('/api/v1', apiV1Router);
app.use('/', webRouter);

app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

app.listen(PORT, HOST, () => {
  console.log(`OpenAlgo Express server running at http://${HOST}:${PORT}`);
});
