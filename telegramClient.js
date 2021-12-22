const { Telegraf, Extra, Markup, Scenes, session } = require("telegraf");
const SceneGenerator = require("./telegramScenes");
const telegramController = require("./telegramController");
const { SantaUser, Op } = require("./db");
const textAnalyzer = require("./textAnalyzer");

// Настройка бота
const bot = new Telegraf(process.env.TELEGRAM_API_KEY);
//bot.use(Telegraf.log());
bot.use(session());

// Работа со сценами
const reviewsScene = new SceneGenerator().ReviewsScene();
const stage = new Scenes.Stage([reviewsScene]);
bot.use(stage.middleware());

// Служебные команды
bot.start((ctx) => {
  ctx.setMyCommands([
    { command: "reviews", description: "Отзывы о фильмах" },
    { command: "santa", description: "Тайный санта" },
    { command: "menu", description: "Главное меню" },
    { command: "hello", description: "Приветствие" },
  ]);
  ctx.reply("Добро пожаловать");
});
bot.help((ctx) => ctx.reply("Send me a sticker"));

// Обработка команд
bot.command("menu", (ctx) => {
  ctx.session = {};
  return ctx.replyWithMarkdownV2(
    "``` Бот умеет организовывать игру в тайного санту и искать отзывы на фильм ```"
  );
});
bot.command("hello", (ctx) => ctx.reply("Привет 👋"));
bot.command("santa", async (ctx) => {
  const [user] = await SantaUser.findOrCreate({
    where: {
      userid: ctx.from.id,
    },
  });
  if (!user.phone) {
    return ctx.reply(
      "Для игры необходимо поделиться контактом с ботом",
      Markup.keyboard([
        Markup.button.contactRequest("📲 Отправить номер телефона"),
      ]).resize()
    );
  }
  if (user.partner != -1) {
    const partner = await SantaUser.findOne({
      where: {
        userid: user.partner,
      },
    });
    ctx.reply("У тебя уже есть, кому дарить подарки!");
    return ctx.replyWithContact(partner.phone, "🎁🎄🎁");
  } else {
    try {
      const potentialPartners = await SantaUser.findAll({
        where: {
          partner: -1,
          userid: {
            [Op.ne]: user.userid,
          },
          phone: {
            [Op.ne]: null,
          },
        },
      });
      if (potentialPartners.length > 0) {
        potentialPartners[0].partner = user.userid;
        await potentialPartners[0].save();
        user.partner = potentialPartners[0].userid;
        user.save();
        ctx.reply("Нашелся твой партнер для тайного санты!");
        return ctx.replyWithContact(potentialPartners[0].phone, "🎁🎄🎁");
      } else {
        return ctx.reply(
          "Сейчас играть не с кем, попробуй позже",
          Markup.keyboard([["/santa"]]).resize()
        );
      }
    } catch (ex) {
      console.log(ex);
    }
  }
});
bot.command("reviews", async (ctx) => {
  ctx.scene.enter("reviews");
});
bot.on("sticker", (ctx) => ctx.reply("👍"));
bot.hears("hi", (ctx) => {});

// Обработка любого сообщения
bot.on("message", async (ctx) => {
  console.log("MESSAGE", ctx.session, ctx.message.contact);
  const text = ctx.message.text;

  // Если фильм
  if (ctx.session?.films?.length) {
    await telegramController.handleFilms(ctx, text);
    ctx.session = {};
    return;
  }

  // Если контакт
  if (ctx.message.contact) {
    try {
      const [user] = await SantaUser.findOrCreate({
        where: {
          userid: ctx.from.id,
        },
      });
      user.phone = ctx.message.contact.phone_number;
      await user.save(user);
      return ctx.reply(
        "Теперь тебе доступны все функции бота!",
        Markup.keyboard([["/santa"]]).resize()
      );
    } catch (ex) {
      console.log(ex);
    }
  }

  ctx.session = {};
  return ctx.reply(
    "Настроение сообщения: " + (await textAnalyzer.tonal(text, true)).score,
    telegramController.noButton
  );
  //console.log(ctx.callbackQuery?.data);
});

module.exports = bot;
