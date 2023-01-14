import { app as config } from './config.js';
import { app } from './app.js';
import { V9kuClient } from './v9ku/v9ku.client.js';
import { ForrumClient } from './forrum/forrum.client.js';

// Handle bots and appliction
const v9kuBot = new V9kuClient();
const forrumBot = new ForrumClient();
Promise.all([await v9kuBot.init(), await forrumBot.init()])
  .then(() => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] All bots started`);
    app.listen(config.port, () => {
      console.log(
        `[${new Date().toLocaleString('ru-RU')}] [Express] App is listening on http://localhost:${
          config.port
        }`,
      );
    });
  })
  .catch((ex) => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] Bots has not been started`, ex);
  });

// Enable graceful shutdown
process.once('SIGINT', async () => {
  await forrumBot.stop('SIGINT');
  await v9kuBot.stop('SIGINT');
  process.exit();
});
process.once('SIGTERM', async () => {
  await forrumBot.stop('SIGTERM');
  await v9kuBot.stop('SIGTERM');
  process.exit();
});
