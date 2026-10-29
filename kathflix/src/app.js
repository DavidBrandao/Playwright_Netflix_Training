const path = require('node:path');
const express = require('express');
const { notFound, errorHandler } = require('./errors');

function createApp({ dbPath = ':memory:', uploadDir, testApi } = {}) {
  const app = express();
  app.locals.uploadDir = uploadDir || path.join(__dirname, '..', 'public', 'uploads');
  app.locals.testApi = testApi !== undefined ? testApi : process.env.KATHFLIX_TEST_API !== 'off';

  app.use(express.json());
  app.use('/uploads', express.static(app.locals.uploadDir));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api', notFound);
  app.get('/', (req, res) => res.redirect('/login.html'));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
