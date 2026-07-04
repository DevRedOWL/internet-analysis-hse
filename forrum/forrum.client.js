import path from 'path';
import { Telegraf, Scenes } from 'telegraf';
import SceneBuilder from './forrum.scenes.js';
import { db, credentials } from '../config.js';
import PostgresSession from 'telegraf-postgres-session';
import { ForrumUser, initDB } from './forrum.db.js';
import {
  ForrumProfessionalStatus,
  ForrumStep,
  ForrumChallenges,
  ForrumChannels,
  ForrumSecretPhrases,
} from './forrum.enum.js';
import { getPrices, professionalStatusMarkup, profileOffer } from './forrum.service.js';
import { ForrumQueue } from './forrum.queue.js';

// Настройка бота
export class ForrumClient {
  bot;
  queue;
  botName = 'Forrum';

  async init() {
    await initDB(async () => {
      console.log(`[${new Date().toLocaleString('ru-RU')}] [${this.botName}] DB ready`);
      this.queue = new ForrumQueue(this.bot.telegram);
      this.queue.initWorkers();
      console.log(`[${new Date().toLocaleString('ru-RU')}] [${this.botName}] Message queue ready`);
      this.bot.launch();
    });
  }

  async stop(signal = 'SIGINT') {
    await this.bot.stop(signal);
  }

  constructor() {
    console.log(`[${new Date().toLocaleString('ru-RU')}] [${this.botName}] Starting a bot...`);
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
        await ctx.reply(`Привет! Добро пожаловать в FORRUM-бот 🤝 
И спасибо, что вы проявили интерес к нашей платформе! Нам тоже не терпится начать работу, но сначала - слово основателя🤓
    `);
        await ctx.replyWithVideoNote({
          source: path.join('./forrum/', '/forrum.welcome.mp4'),
          filename: 'forrum_welcome.mp4',
        });
        ctx.reply(...professionalStatusMarkup);
        await this.queue.notifyUser(ctx.from.id, ForrumStep.PROFESSIONAL_STATUS);
        return await ForrumUser.update(
          {
            step: ForrumStep.PROFESSIONAL_STATUS,
            enabled: true,
          },
          { where: { userId: ctx.from.id } },
        );
      } else {
        await ctx.reply(`Вы уже зарегестрированы`);
      }
    });
    bot.help((ctx) => ctx.replyWithMarkdown(`*Инструкция отсутствует*`));

    // Выбор статуса
    for (let statusId in ForrumProfessionalStatus) {
      bot.action(`STATUS_${statusId}`, async (ctx) => {
        ctx.editMessageText(
          `Спасибо за ответ! \nПожалуйста, подтвердите выбор - вы "${ForrumProfessionalStatus[statusId]}"?`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Подтвердить', callback_data: 'confirm_status' }],
                [{ text: 'Вернуться', callback_data: 'decline_status' }],
              ],
            },
          },
        );
        return await ForrumUser.update({ status: statusId }, { where: { userId: ctx.from.id } });
      });
    }
    bot.action(`decline_status`, async (ctx) => {
      ctx.editMessageText(...professionalStatusMarkup);
    });
    bot.action(`confirm_status`, async (ctx) => {
      await this.queue.notifyUser(ctx.from.id, ForrumStep.PROFESSIONAL_STATUS);
      await ForrumUser.update({ step: ForrumStep.QUIZ }, { where: { userId: ctx.from.id } });
      ctx.editMessageText('Статус сохранен');
      ctx.replyWithPoll(
        'Пожалуйста, поделитесь, сталкивались ли вы с какими-то из этих вызовов как предприниматель/руководитель за прошедший год?',
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
          'В кризисное время тысячи руководителей по всей России ищут необходимые ответы и новые опоры для себя и своего бизнеса. \nЭти и другие вопросы участники решают в FORRUM. Обмен кейсами и опытом, поддержка со стороны равных и открытый диалог помогают предпринимателям и руководителям совершать меньше ошибок и находить новые возможности для развития бизнеса. FORRUM позволяет взглянуть на проблемы с других ракурсов!🏄‍♂️',
        );
        await this.queue.notifyUser(ctx.pollAnswer.user.id, ForrumStep.CONFIRM_PRICES);
        await ForrumUser.update(
          { step: ForrumStep.CONFIRM_PRICES },
          { where: { userId: ctx.pollAnswer.user.id } },
        );
        await ctx.telegram.sendMessage(ctx.pollAnswer.user.id, getPrices(), {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Отлично, двигаемся дальше!', callback_data: 'confirm_prices' }],
            ],
          },
        });
      }
    });

    // Прайс
    bot.action('confirm_prices', async (ctx) => {
      await ctx.editMessageText(getPrices());
      return ctx.replyWithMarkdown(
        'Чтобы продолжить, пожалуйста, поделитесь с нами вашим номером телефона. Так нам будет проще связаться с вами в дальнейшем 🙌',
        {
          reply_markup: {
            one_time_keyboard: true,
            keyboard: [[{ text: 'Подтвердить участие', request_contact: true }]],
            force_reply: true,
          },
        },
      );
    });
    bot.on('contact', async (ctx) => {
      const user = await ForrumUser.findOne({ where: { userId: ctx.from.id } });
      if (user.step == ForrumStep.CONFIRM_PRICES) {
        await this.queue.notifyUser(user.id, ForrumStep.VIEW_MEMBERS);
        await ForrumUser.update(
          {
            phone: ctx.message.contact.phone_number,
            name: `${ctx.message.contact.first_name} ${ctx.message.contact.last_name || ''}`.trim(),
            step: ForrumStep.VIEW_MEMBERS,
          },
          { where: { id: user.id } },
        );
        ctx.reply(`${ctx.from.first_name}, хотите посмотреть, кто уже присоеденился к FORRUM?`, {
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
      await ctx.editMessageText(
        `Вы можете познакомиться с первыми участниками в канале. Ждем с нетерпением, когда здесь появится и ваш профиль 🚀`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: 'Перейти в канал', url: ForrumChannels.profiles }]],
            force_reply: true,
          },
        },
      );
      return await profileOffer(ctx);
    });
    bot.action('skip_members', async (ctx) => {
      await ctx.editMessageText(`Хорошо! Тогда идем дальше 👇`);
      return await profileOffer(ctx);
    });

    // Заполнение профиля
    bot.action('profile', async (ctx) => {
      await this.queue.notifyUser(ctx.from.id, ForrumStep.PROFILE);
      await ForrumUser.update({ step: ForrumStep.PROFILE }, { where: { userId: ctx.from.id } });
      await ctx.editMessageText(`Вы перешли к редактированию профиля`);
      ctx.scene.enter('profileScene');
    });

    // Настройка рассылки
    bot.command('stop', async (ctx) => {
      const [user] = await ForrumUser.update(
        { enabled: false },
        {
          where: {
            userId: ctx.from.id,
          },
        },
      );
      return ctx.reply('Рассылка прекращена');
    });

    // Обработка любого сообщения
    bot.on('message', async (ctx) => {
      const { text } = ctx.message;
      const user = await ForrumUser.findOne({ where: { userId: ctx.from.id } });
      if (user.step == ForrumStep.PROFESSIONAL_STATUS) {
        if (ForrumSecretPhrases.indexOf(text.trim()) !== -1) {
          ctx.reply('Понял вас!');
          await this.queue.notifyUser(user.userId, ForrumStep.VIEW_MEMBERS);
          await ForrumUser.update(
            { step: ForrumStep.VIEW_MEMBERS },
            { where: { userId: user.userId } },
          );
          return await profileOffer(ctx);
        } else {
          return ctx.reply(
            'Кодовое слово некорректно! :(\nОбратитесь в поддержку, если вам нужна помощь',
          );
        }
      }
      // TODO: Add secret phrase support
      return ctx.reply('Я не понимаю эту команду');
    });

    // Set property
    this.bot = bot;
  }
}
