import { Telegraf, Scenes } from 'telegraf';
import { markdownTable } from 'markdown-table';
import { V9kuUser, V9kuMatch, V9kuMessage, V9kuVote } from './v9ku.db.js';
import {
  scoreButtonsBuilder,
  matchCaptionBuilder,
  votedCaptionBuilder,
  extractMessageContext,
  buildAllCommands,
} from './v9ku.service.js';
import SceneBuilder from './v9ku.scenes.js';
import { db, credentials, admins } from '../config.js';
import PostgresSession from 'telegraf-postgres-session';

// Настройка бота
console.log(`[${new Date().toLocaleString('ru-RU')}] [V9ku] Starting a bot...`);
const bot = new Telegraf(credentials.v9ku_token);
const pgSession = new PostgresSession({
  connectionString: `${db.dialect}://${db.user}:${db.password}@${db.host}:${db.port}/${db.database}`,
  ssl: false,
}).middleware();
bot.use(pgSession);

// Сцены
const createEventScene = new SceneBuilder().EventCreateScene();
const setScoreScene = new SceneBuilder().ScoreSetScene();
const sendingScene = new SceneBuilder().SendingScene();
const stage = new Scenes.Stage([createEventScene, setScoreScene, sendingScene]);
bot.use(stage.middleware());
bot.command('create_match', async (ctx) => {
  if (admins.list.indexOf(ctx.from.id) !== -1) {
    ctx.scene.enter('create_match');
  } else {
    ctx.reply(admins.error_message);
  }
});
bot.command('set_score', async (ctx) => {
  if (admins.list.indexOf(ctx.from.id) !== -1) {
    ctx.scene.enter('set_score');
  } else {
    ctx.reply(admins.error_message);
  }
});
bot.command('sending', async (ctx) => {
  if (admins.list.indexOf(ctx.from.id) !== -1) {
    ctx.scene.enter('sending');
  } else {
    ctx.reply(admins.error_message);
  }
});

// Служебные команды
bot.start(async (ctx) => {
  const [user] = await V9kuUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  await ctx.reply(`Добро пожаловать в бота "ВДевятку"\nДля получения инструкции введите /help`);
  if (!user.enabled) {
    return ctx.replyWithMarkdown(
      'Если вы хотите стать участником, подтвердите согласие на участие в таблице лидеров. \nДля этого предоставьте боту доступ к вашему контакту',
      {
        reply_markup: {
          one_time_keyboard: true,
          keyboard: [[{ text: '⚽ Согласен с правилами', request_contact: true }]],
          force_reply: true,
        },
      },
    );
  }
});
bot.on('contact', async (ctx) => {
  const user = await V9kuUser.findOne({ where: { userId: ctx.from.id } });
  await V9kuUser.update(
    {
      phone: ctx.message.contact.phone_number,
      name: `${ctx.message.contact.first_name} ${ctx.message.contact.last_name}`,
      enabled: true,
    },
    { where: { id: user.id } },
  );
  ctx.telegram.setMyCommands(buildAllCommands(), {
    scope: { type: 'chat', chat_id: ctx.from.id },
  });
  ctx.reply(`${ctx.from.first_name}, теперь вы можете принимать участие в прогнозах!`, {
    reply_markup: { remove_keyboard: true },
  });
});
bot.help((ctx) =>
  ctx.replyWithMarkdown(`*Инструкция:*

Привет! Я прогнозный бот и сделаю твою жизнь в турнире ярче и веселей ⚽️🤪
Каждый день буду отправлять прогнозы на матч, считать очки и составлять итоговую таблицу.
‼️*За 1 час* до матча прием прогнозов завершается‼️

В меню ниже 3 команды:
/score - индивидуальные данные (общий счет / всего прогнозов / точные прогнозы )
/rating - общая таблица с результатами
/help - текущая инструкция и ответы на частозадаваемые вопросы

Удачи тебе!
P.S. По всем вопросам пиши @DimaTomchuk`),
);

// Настройка рассылки
bot.command('stop', async (ctx) => {
  const [user] = await V9kuUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  user.enabled = false;
  await user.save();
  return ctx.reply('Рассылка прекращена');
});

// Счет
bot.command('rating', async (ctx) => {
  const formattedUsers = (await V9kuUser.findAll({ limit: 30 }))
    .sort((u1, u2) => (u1.score > u2.score ? -1 : 1))
    .map((user, idx) => [
      idx + 1,
      user.score,
      (idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '') + user.name.trim(0, 30),
    ]);
  const table = markdownTable([['Место', 'Счет', 'Имя'], ...formattedUsers], {
    delimiterStart: false,
    delimiterEnd: false,
  });
  ctx.replyWithMarkdown(`*Лучшие 30 участников*\n\n\`\`\`\n${table}\n\`\`\``);
});

bot.command('score', async (ctx) => {
  const user = await V9kuUser.findOne({ where: { userId: ctx.from.id } });
  if (!user) {
    return ctx.replyWithMarkdown(
      `Ваш профиль не настроен, возможно не приняты условия использования`,
    );
  }
  const votesCount = await V9kuVote.count({ where: { userId: ctx.from.id } });
  const table = markdownTable([
    ['Ваши результаты'],
    ['Общий счет', user.score],
    ['Всего прогнозов', votesCount],
    ['Точных прогнозов', user.perfect],
    //['Дата регистрации', user.createdAt.toLocaleDateString('ru-RU')],
  ]);
  ctx.replyWithMarkdown(`\`\`\`\n${table}\n\`\`\``);
});

// Тестовый
bot.command('test', async (ctx) => {
  if (admins.list.indexOf(ctx.from.id) === -1) {
    ctx.reply(admins.error_message);
  }

  const matchData = await V9kuMatch.findOne({
    where: { id: 0 },
  });
  const caption = matchCaptionBuilder(ctx.from.first_name, matchData);

  const message = await ctx.replyWithMarkdown(caption.text, {
    reply_markup: {
      inline_keyboard: [caption.buttons],
    },
  });
  await V9kuMessage.create({
    messageId: message.message_id,
    userId: ctx.from.id,
    matchId: matchData.id,
  });
});

// Прогнозы
bot.action('predict', async (ctx) => {
  try {
    const { matchData } = await extractMessageContext(ctx);
    if (new Date() > new Date(matchData.date.getTime() - 60000)) {
      return await ctx.editMessageText('Время голосования за этот матч вышло');
    }
    await ctx.editMessageText(
      `Выберите, сколько забъет каждая команда, \nзатем, нажмите "Предсказать"\nЕсли выбираете 6+, не забудьте после сохранения\nотправить точный ответ @DimaTomchuk`,
      {
        reply_markup: {
          inline_keyboard: scoreButtonsBuilder(matchData.team1, matchData.team2),
        },
      },
    );
  } catch (ex) {
    return await ctx.editMessageText('Произошла ошибка, обратитесь к администратору');
  }
});
for (let i = 1; i <= 2; i++) {
  for (let j = 0; j <= 6; j++) {
    bot.action(`team${i}_${j}`, async (ctx) => {
      const { matchData } = await extractMessageContext(ctx);
      const [vote] = await V9kuVote.findOrCreate({
        where: {
          matchId: matchData.id,
          userId: ctx.from.id,
        },
      });
      const score = j < 6 ? j : -1;
      await V9kuVote.update({ [`team${i}`]: score }, { where: { id: vote.id } });
      try {
        await ctx.editMessageText(
          `Выберите, сколько забъет каждая команда, затем, нажмите "Сохранить прогноз"`,
          {
            reply_markup: {
              inline_keyboard: scoreButtonsBuilder(matchData.team1, matchData.team2, {
                1: i === 1 ? j : vote.team1 >= 0 ? vote.team1 : 6,
                2: i === 2 ? j : vote.team2 >= 0 ? vote.team2 : 6,
              }),
            },
          },
        );
      } catch (ex) {
        console.log('Юзер нажал ту же кнопку', ex.message);
      }
    });
  }
}
bot.action('confirm_prediction', async (ctx) => {
  const { matchData } = await extractMessageContext(ctx);
  if (new Date() > new Date(matchData.date.getTime() - 1000 * 60)) {
    return await ctx.editMessageText('Время голосования за этот матч вышло');
  }
  const voteData = await V9kuVote.findOne({
    where: {
      matchId: matchData.id,
      userId: ctx.from.id,
    },
  });
  if (voteData && typeof voteData.team1 == 'number' && typeof voteData.team2 == 'number') {
    const caption = votedCaptionBuilder(ctx.from.first_name, matchData, voteData);

    await ctx.editMessageText(caption.text, {
      reply_markup: {
        inline_keyboard: [caption.buttons],
      },
    });
  }
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
