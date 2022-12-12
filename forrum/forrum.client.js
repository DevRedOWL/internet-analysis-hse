import path from 'path';
import { Telegraf, Scenes } from 'telegraf';
import SceneBuilder from './forrum.scenes.js';
import { db, credentials, admins } from '../config.js';
import PostgresSession from 'telegraf-postgres-session';
import { ForrumUser } from './forrum.db.js';
import { ForrumStatus, ForrumStep, ForrumChallenges, ForrumChannels } from './forrum.enum.js';
import { professionalStatusMarkup, profileOffer } from './forrum.service.js';

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
  if (!user.enabled) {
    await ctx.reply(`Приветственный текст, после которого идет видео`);
    await ctx.replyWithVideoNote({
      source: path.join('./forrum/', '/forrum.welcome.mp4'),
      filename: 'forrum_welcome.mp4',
    });
    ctx.replyWithMarkdownV2(...professionalStatusMarkup);
    return await ForrumUser.update(
      {
        step: ForrumStep.PROFESSIONAL_STATUS,
        //enabled: true,
      },
      { where: { userId: ctx.from.id } },
    );
  } else {
    await ctx.reply(`Вы уже зарегестрированы`);
  }
});
bot.help((ctx) => ctx.replyWithMarkdown(`*Инструкция отсутствует*`));

// Выбор статуса
for (let statusId in ForrumStatus) {
  bot.action(`STATUS_${statusId}`, async (ctx) => {
    ctx.editMessageText(`Вы уверены, что хотите выбрать статус "${ForrumStatus[statusId]}"?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Подтвердить', callback_data: 'confirm_status' }],
          [{ text: 'Вернуться', callback_data: 'decline_status' }],
        ],
      },
    });
    return await ForrumUser.update({ status: statusId }, { where: { userId: ctx.from.id } });
  });
}
bot.action(`decline_status`, async (ctx) => {
  ctx.editMessageText(...professionalStatusMarkup);
});
bot.action(`confirm_status`, async (ctx) => {
  await ForrumUser.update({ step: ForrumStep.QUIZ }, { where: { userId: ctx.from.id } });
  ctx.editMessageText('Статус сохранен');
  ctx.replyWithPoll(
    'С какими трудностями вы сталкивались в своей деятельности?',
    ForrumChallenges,
    {
      allows_multiple_answers: true,
      is_anonymous: false,
    },
  );
});

// Анкета
bot.on('poll_answer', async (ctx) => {
  const { step } = await ForrumUser.findOne({ where: { userId: ctx.pollAnswer.user.id } });
  if (step == ForrumStep.QUIZ) {
    await ctx.telegram.sendMessage(
      ctx.pollAnswer.user.id,
      'В кризисное время тысячи руководителей по всей России были в таком же шоке как и ты, да и мы тоже, если честно, ну ничего, присоединяйся и ща разберемся че кого',
    );
    await ForrumUser.update(
      { step: ForrumStep.CONFIRM_PRICES },
      { where: { userId: ctx.pollAnswer.user.id } },
    );
    await ctx.telegram.sendMessage(ctx.pollAnswer.user.id, 'Стоимость участия', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Отлично, двигаемся дальше!',
              callback_data: 'confirm_prices',
            },
          ],
        ],
      },
    });
  }
});

// Прайс
bot.action('confirm_prices', async (ctx) => {
  await ctx.editMessageText('Стоимость участия'); // FIXME: Don't forget
  return ctx.replyWithMarkdown('Чтобы продолжить, поделитесь с нами вашим номером телефона!', {
    reply_markup: {
      one_time_keyboard: true,
      keyboard: [[{ text: 'Подтвердить участие', request_contact: true }]],
      force_reply: true,
    },
  });
});
bot.on('contact', async (ctx) => {
  const user = await ForrumUser.findOne({ where: { userId: ctx.from.id } });
  if (user.step == ForrumStep.CONFIRM_PRICES) {
    await ForrumUser.update(
      {
        phone: ctx.message.contact.phone_number,
        name: `${ctx.message.contact.first_name} ${ctx.message.contact.last_name || ''}`.trim(),
        step: ForrumStep.VIEW_MEMBERS,
      },
      { where: { id: user.id } },
    );
    ctx.reply(`${ctx.from.first_name}, хотите посмотреть, кто уже состоит в FORRUM?`, {
      reply_markup: {
        remove_keyboard: true,
        inline_keyboard: [
          [
            { text: 'Да', callback_data: 'view_members' },
            { text: 'В другой раз', callback_data: 'skip_members' },
          ],
        ],
      },
    });
  }
});

// Просмотр участников
bot.action('view_members', async (ctx) => {
  await ctx.editMessageText(`Можете посмотреть всех участников в нашем канале`, {
    reply_markup: {
      inline_keyboard: [[{ text: 'Перейти в канал', url: ForrumChannels.profiles }]],
      force_reply: true,
    },
  });
  return await profileOffer(ctx);
});
bot.action('skip_members', async (ctx) => {
  await ctx.editMessageText(`Хорошо! Тогда идем дальше`);
  return await profileOffer(ctx);
});

// Заполнение профиля
bot.action('profile', async (ctx) => {
  await ForrumUser.update({ step: ForrumStep.PROFILE }, { where: { userId: ctx.from.id } });
  await ctx.editMessageText(`Вы перешли к редактированию профиля`);
  ctx.scene.enter('profileScene');
});

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
  const { text } = ctx.message;
  // TODO: Add secret phrase support
  return ctx.reply('Я не понимаю эту команду');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
