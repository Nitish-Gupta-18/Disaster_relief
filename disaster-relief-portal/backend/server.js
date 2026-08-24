const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');
const requestsRouter = require('./routes/requests');
const volunteersRouter = require('./routes/volunteers');
const inventoryRouter = require('./routes/inventory');
const dashboardRouter = require('./routes/dashboard');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');

const app = express();
const PORT = Number(process.env.PORT || 5001);

db.initDb();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    return callback(null, allowed);
  }
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Disaster Relief Coordination Portal', port: PORT });
});

app.use('/api/requests', requestsRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);

const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Disaster Relief Coordination Portal API running on http://localhost:${PORT}`);
});
