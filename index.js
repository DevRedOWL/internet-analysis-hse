import { V9kuClient } from './v9ku/v9ku.client.js';
import { ForrumClient } from './forrum/forrum.client.js';

Promise.all([await new V9kuClient().init(), await new ForrumClient().init()])
  .then(() => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] All bots started`);
  })
  .catch((ex) => {
    console.log(`[${new Date().toLocaleString('ru-RU')}] Bots has not been started`, ex);
  });
