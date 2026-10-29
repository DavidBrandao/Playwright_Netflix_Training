const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./src/app');

const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const app = createApp({ dbPath: process.env.KATHFLIX_DB || path.join(dataDir, 'kathflix.db') });
app.listen(port, () => {
  console.log(`KathFlix no ar: http://localhost:${port}`);
  console.log(`Swagger:        http://localhost:${port}/api-docs`);
});
