const { Scenes, Markup } = require("telegraf");
const { TinkoffUser, Op } = require("./db");
const config = require("./config");

function calculateBounds(center, scaleDenominator) {
  const quantifier = 2.2; // 2.2
  const halfWDeg = 0.84 * Math.pow(quantifier, 9 - scaleDenominator);
  const halfHDeg = 2.215 * Math.pow(quantifier, 9 - scaleDenominator);
  //
  return {
    bottomLeft: {
      lat: center.lat - halfWDeg,
      lng: center.lng - halfHDeg,
    },
    topRight: {
      lat: center.lat + halfWDeg,
      lng: center.lng + halfHDeg,
    },
  };
}

class SceneGenerator {
  TinkoffScene() {
    const tinkoff = new Scenes.BaseScene("map");
    tinkoff.enter((ctx) =>
      ctx.reply(`Инструкция по добавлению координат:\n
1. Зайдите на сайт https://www.tinkoff.ru/maps/atm/
2. Найдите в поиске ваш город, расположите карту на экране таким образом, чтобы было видно всю зону, в которой необходимо найти банкоматы
3. ВАЖНО! Зона не должна быть больше размера вашего города, потому что если банкоматов будет слишком много, возникнут серьезные трудности с обработкой данных
4. Но все таки она должна быть чуть больше того радиуса, в котором будет происходить поиск банкоматов, расположенные у края не всегда попадают в выборку
5. Скопируйте ВСЮ ссылку из адресной строки на сайте тинькофф (она стала чуть длиннее чем была) и просто отправьте боту в ответ на это сообщение
6. Вы восхитительны, осталось только включить валюту и можете ждать писем счастья =)

P.S. Если вы находитесь в Москве, пожалуйста, не выбирайте прямо весь город, думаю района будет дотаточно, там слишком много банкоматов
    `)
    );
    tinkoff.on("text", async (ctx) => {
      const url = ctx.message.text;
      if (url === "/exit") {
        ctx.reply("Вы вышли из режима настройки карты");
        return await ctx.scene.leave();
      }

      try {
        const lat = Number(url.match(/(latitude=([^\\]+?)&)/)[2]);
        const lng = Number(url.match(/(longitude=([^\\]+?)&)/)[2]);
        const zoomValue = url.match(/(zoom=([^\\]+?)&)/);
        const zoomValueEnd = url.match(/zoom=(.*)/);
        const zoom = Number(zoomValue ? zoomValue[2] : zoomValueEnd[1]);
        if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) {
          ctx.reply(
            "Ошибка при отправке ссылки, попробуйте вставить еще раз или введите /exit для выхода"
          );
          return ctx.scene.reenter();
        }
        if (zoom < 8.5) {
          ctx.reply("Слишком большая область для поиска банкоматов");
          console.log("Нарушитель границ: ", ctx.from.id);
          return ctx.scene.leave();
        }
        const bounds = calculateBounds({ lat, lng }, zoom);

        const [user] = await TinkoffUser.findOrCreate({
          where: {
            userId: ctx.from.id,
          },
        });
        user.bounds = bounds;
        await user.save();
        ctx.reply(
          `Данные координат сохранены\n${
            user.enabled
              ? "Все готово, ожидайте рассылку"
              : "Не забудьте установить валюту"
          }`
        );
        return await ctx.scene.leave();
      } catch (ex) {
        console.log(ex);
        ctx.reply(
          "Это не похоже на правильную ссылку, попробуйте повторно скопировать правильную по инструкции или введите /exit для выхода"
        );
        return await ctx.scene.reenter();
      }
    });
    tinkoff.leave((ctx) => (ctx.context = {}));
    return tinkoff;
  }

  SendingScene() {
    const sending = new Scenes.BaseScene("sending");
    sending.enter((ctx) => {
      if (ctx.from.id != config.admin.id) {
        ctx.reply(config.admin.error_message);
        ctx.scene.leave();
      }
      ctx.reply(`Введите сообщение для рассылки или /exit для выхода`);
    });
    sending.on("text", async (ctx) => {
      const msg = ctx.message.text;
      if (msg === "/exit") {
        ctx.reply("Вы вышли из режима рассылки");
        return await ctx.scene.leave();
      }

      try {
        const users = await TinkoffUser.findAll();
        for (let user of users) {
          try {
            await ctx.telegram.sendMessage(user.getDataValue("userId"), msg);
          } catch (ex) {
            console.log(`Blocked user ${user.getDataValue("userId")}`)
          }
        }
        ctx.replyWithMarkdown(
          `*Сообщение успешно отправлено ${users.length} пользователям:*\n\n${msg}`
        );
      } catch (ex) {
        ctx.reply("Ошибка при рассылке");
        console.log(ex);
      }
      return await ctx.scene.leave();
    });
    sending.leave((ctx) => (ctx.context = {}));
    return sending;
  }
}

module.exports = SceneGenerator;
