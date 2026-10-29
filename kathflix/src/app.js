const path = require('node:path');
const express = require('express');
const { notFound, errorHandler } = require('./errors');
const { openDb } = require('./db');

function createApp({ dbPath = ':memory:', uploadDir, testApi } = {}) {
  const app = express();
  app.locals.uploadDir = uploadDir || path.join(__dirname, '..', 'public', 'uploads');
  app.locals.testApi = testApi !== undefined ? testApi : process.env.KATHFLIX_TEST_API !== 'off';
  app.locals.db = openDb(dbPath);

  app.use(express.json());
  app.use('/uploads', express.static(app.locals.uploadDir));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/titles', require('./routes/titles'));
  app.use('/api/favorites', require('./routes/favorites'));
  app.use('/api/me', require('./routes/me')(app.locals.uploadDir));
  app.use('/api/admin', require('./routes/admin')(app.locals.uploadDir));
  if (app.locals.testApi) app.use('/api/test', require('./routes/test-support'));

  const fs = require('node:fs');
  const YAML = require('yaml');
  const swaggerUi = require('swagger-ui-express');
  const specText = fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8');
  app.get('/api-docs/openapi.yaml', (req, res) => res.type('text/yaml').send(specText));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(YAML.parse(specText), { customSiteTitle: 'KathFlix API' }));

  app.use('/api', notFound);
  app.get('/', (req, res) => res.redirect('/login.html'));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
