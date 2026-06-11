import { app as config } from './config.js';
import { app } from './app.js';
import { V9kuClient } from './v9ku/v9ku.client.js';

const v9kuBot = new V9kuClient();

try {
  await v9kuBot.init();
  console.log(`[${new Date().toLocaleString('ru-RU')}] All bots started`);
  app.listen(config.port, () => {
    console.log(
      `[${new Date().toLocaleString('ru-RU')}] [Express] App is listening on http://localhost:${
        config.port
      }`,
    );
  });
} catch (ex) {
  console.log(`[${new Date().toLocaleString('ru-RU')}] Bots has not been started`, ex);
  process.exit(1);
}

process.once('SIGINT', async () => {
  await v9kuBot.stop('SIGINT');
  process.exit();
});
process.once('SIGTERM', async () => {
  await v9kuBot.stop('SIGTERM');
  process.exit();
});
