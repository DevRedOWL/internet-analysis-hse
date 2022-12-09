import { Telegraf, Scenes } from 'telegraf';
import SceneBuilder from './forrum.scenes.js';
import { db, credentials, admins } from '../config.js';
import PostgresSession from 'telegraf-postgres-session';
import { ForrumUser } from './forrum.db.js';

// Настройка бота
console.log(`[${new Date().toLocaleString('ru-RU')}] [Forrum] Starting a bot...`);
const bot = new Telegraf(credentials.forrum_token);
const pgSession = new PostgresSession({
  connectionString: `${db.dialect}://${db.user}:${db.password}@${db.host}:${db.port}/${db.database}`,
  ssl: false,
}).middleware();
bot.use(pgSession);

// Сцены
const profileScene = new SceneBuilder().ProfileScene();
const stage = new Scenes.Stage([profileScene]);
bot.use(stage.middleware());

// Служебные команды
bot.start(async (ctx) => {
  const [user] = await ForrumUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  await ctx.reply(`Добро пожаловать в бота Forrum`);
  if (!user.enabled) {
    return ctx.replyWithMarkdown(
      'Привет, подтверди свой статус',
      {
        reply_markup: {
          one_time_keyboard: true,
          keyboard: [[{ text: 'Одно' }]],
          force_reply: true,
        },
      },
    );
  }
});
bot.help((ctx) =>
  ctx.replyWithMarkdown(`*Инструкция отсутствует*`),
);

// Настройка рассылки
bot.command('stop', async (ctx) => {
  const [user] = await ForrumUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  user.enabled = false;
  await user.save();
  return ctx.reply('Рассылка прекращена');
});

// Обработка любого сообщения
bot.on('message', async (ctx) => {
  const text = ctx.message.text;
  return ctx.reply('Я не понимаю эту команду');
});
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
