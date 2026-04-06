import './env.js';
import express from 'express';
import ordersHandler from './api/orders.js';
import driverOrdersHandler from './api/driver-orders.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'trip5-backend',
    message: 'Use POST /api/orders to submit an order. Drivers: GET/POST /api/driver-orders.',
  });
});

app.post('/api/orders', (req, res) => ordersHandler(req, res));
app.get('/api/driver-orders', (req, res) => driverOrdersHandler(req, res));
app.post('/api/driver-orders', (req, res) => driverOrdersHandler(req, res));

app.listen(PORT, () => {
  console.log(`trip5-backend listening on port ${PORT}`);
});

