const { Telegraf, Extra, Markup, Scenes, session } = require("telegraf");
const SceneGenerator = require("./telegramScenes");
const { TinkoffUser, Op } = require("./db");
const axios = require("axios");

// Настройка бота
const bot = new Telegraf(process.env.TELEGRAM_API_KEY);
//bot.use(Telegraf.log());
bot.use(session());

// Работа со сценами
const tinkoffScene = new SceneGenerator().TinkoffScene();
const stage = new Scenes.Stage([tinkoffScene]);
bot.use(stage.middleware());

async function startSending() {
  let usersActive = 0;
  const limit = new Date(Date.now() - 5 * 60000);

  setInterval(async () => {
    try {
      const found = await TinkoffUser.findAll({
        where: {
          enabled: true,
          lastRequest: {
            [Op.lte]: limit,
          },
          bounds: {
            [Op.not]: null,
          },
        },
      });
      usersActive = found.length;
      for (let user of found) {
        const { currency, userId, bounds } = user.dataValues;
        askCurrency(currency, userId, bounds);
      }
      console.log(`Sending to ${usersActive} people`);
    } catch (ex) {
      console.log("Рассылка moment");
      bot.telegram.sendMessage(
        236413395,
        `Боту плохо, пользователей активно: ${usersActive}`
      );
    }
  }, 60000);
}
startSending();

function askCurrency(currency, chatId, bounds) {
  axios
    .post("https://api.tinkoff.ru/geo/withdraw/clusters", {
      bounds,
      filters: {
        banks: ["tcs"],
        showUnavailable: true,
        currencies: [currency],
      },
      zoom: 12,
    })
    .then((response) => {
      const { clusters } = response.data.payload;
      if (clusters.length > 0) {
        const result = clusters
          .map((cluster) => cluster.points)
          .reduce((acc, cur) => [...acc, ...cur], [])
          .map(
            (i) =>
              `Адрес: ${i.address}\nСумма: ${
                i.limits.filter((limit) => limit.currency === "EUR")[0].amount
              }\nhttps://www.google.com/maps/@${i.location.lat},${
                i.location.lng
              },14z?hl=RU`
          );
        bot.telegram.sendMessage(
          chatId,
          result.reduce((acc, cur) => acc + "\n\n" + cur, "")
        );
        // Update usage
        TinkoffUser.findOne({
          where: {
            userId: chatId,
          },
        })
          .then(async (user) => {
            user.lastRequest = new Date();
            await user.save();
          })
          .catch();
      } else {
        // Не нашли валюту
      }
    })
    .catch((ex) => console.log(ex.message));
}

// Служебные команды
bot.start((ctx) => {
  ctx.telegram.setMyCommands([
    { command: "/map", description: "Выбор города" },
    { command: "usd", description: "Доллар" },
    { command: "eur", description: "Евро" },
    { command: "stop", description: "Прекратить рассылку" },
    { command: "start", description: "Получить эту инструкцию еще раз" },
  ]);
  ctx.reply(
    `Добро пожаловать, мои дорогие, в эти непростые времена данная штуковина поможет найти банкомат для снятия наличной валюты в вашем городе\n\nПравила использования (ОБЯЗАТЕЛЬНО ПРОЧТИТЕ):
1. Если перестали использовать бота т.к. валюта больше не нужна или же по любой другой причине, пожалуйста отключите подписку, введя /stop чтобы понизить награзку
2. Уважайте коллег, не распространяйте ссылку на бота нигде, не добавляйте друзей, не спамьте, в противном случае он будет отключен для всех 
3. Бот работает на одну валюту для одного человека (пожалуйста, не создавайте фейки (и не пытайтесь меня обмануть, в противном случае читать пункт 2))
4. Частота обновления данных - одна минута, если был найден хотя бы один банкомат - следующее уведомление прийдет только через 5 минут (во избежание массового спама)
5. Не забывайте, что бот отображает только банкоматы Тинькофф (партнерские банки - нет)
6. У Тинькова иногда наблюдаются задержки в отображении данных в API, что так же влияет на точность показателей

Порядок настройки бота:
1. Отправить /map для установки вашего города
2. Установить валюту через /usd или /eur
3. Дождаться когда придет оповещение

Важно понимать, что можно легко не успеть, даже если отреагировали на рассылку моментально,
Разработчик НЕ НЕСЕТ ответственности за потраченные нервы и несвоевременно предоставленную информацию\n`
  );
});
bot.help((ctx) => ctx.reply("Введите /start для отображения меню"));

// Обработка команд
bot.command("usd", async (ctx) => {
  const [user] = await TinkoffUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  user.currency = "USD";
  user.enabled = true;
  await user.save();
  return ctx.reply("Валюта USD установлена");
});
bot.command("eur", async (ctx) => {
  const [user] = await TinkoffUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  user.currency = "EUR";
  user.enabled = true;
  await user.save();
  return ctx.reply("Валюта EUR установлена");
});
bot.command("stop", async (ctx) => {
  const [user] = await TinkoffUser.findOrCreate({
    where: {
      userId: ctx.from.id,
    },
  });
  user.enabled = false;
  await user.save();
  return ctx.reply("Рассылка прекращена");
});
bot.command("map", async (ctx) => {
  ctx.scene.enter("map");
});

// Обработка любого сообщения
bot.on("message", async (ctx) => {
  const text = ctx.message.text;
  return ctx.reply("Я не понимаю эту команду");
});

module.exports = bot;
