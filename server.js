const { createApp } = require('./server/app');
const { connectDatabase, disconnectDatabase } = require('./server/config/database');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const app = createApp();

async function start() {
  await connectDatabase();
  const server = app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`Snifr Express server is running at http://${displayHost}:${PORT}`);
  });

  const stop = () => server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

start().catch(error => {
  console.error('Snifr could not start:', error.message);
  process.exit(1);
});
