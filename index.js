// V9ku bot
import { init as v9kuInitDb } from './v9kuDb.js';
import v9kuApp from './v9kuClient.js';
const v9kuInitPromise = new Promise(async (resolve) => {
  await v9kuInitDb(async () => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] [V9ku] DB ready`);
    await v9kuApp.launch();
  });
  resolve();
});

Promise.all([v9kuInitPromise])
  .then(() => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] All bots started`);
  })
  .catch((ex) => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] Bots has not been started`, ex);
  });
