const { Scenes, Markup } = require("telegraf");
const { TinkoffUser, Op } = require("./db");

function calculateBounds(center, scaleDenominator) {
  const resolution = 1 / ((1 / scaleDenominator) * 4374754 * 72);
  const halfWDeg = (1920 * resolution) / 2;
  const halfHDeg = (1080 * resolution) / 2;
  //
  const left = center.lng - halfWDeg;
  const bottom = center.lat - halfHDeg;
  const right = center.lng + halfWDeg;
  const top = center.lat + halfHDeg;
  //
  return {
    bottomLeft: {
      lat: bottom,
      lng: left,
    },
    topRight: {
      lat: top,
      lng: right,
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
        ctx.reply("Выход из режима установки координат");
        return await ctx.scene.leave();
      }

      try {
        const lat = Number(url.match(/(latitude=([^\\]+?)&)/)[2]);
        const lng = Number(url.match(/(longitude=([^\\]+?)&)/)[2]);
        const zoom = Number(url.match(/(zoom=([^\\]+?)&)/)[2]);
        if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) {
          ctx.reply(
            "Ошибка при отправке ссылки, попробуйте вставить еще раз или введите /exit для выхода"
          );
          return ctx.scene.reenter();
        }
        if (zoom < 10) {
          ctx.reply(
            "Ну че то ты уж прям блин совсем большую захотел, еще раз такой прикол выкинешь и забаню, правила использования для кого написаны?"
          );
          console.log("Злостный нарушитель: ", ctx.from.id);
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
            user.enabled ? "Все готово, ожидайте рассылку" : "Не забудьте установить валюту"
          }`
        );
        return await ctx.scene.leave();
      } catch (ex) {
        ctx.reply(
          "Это не похоже на правильную ссылку, попробуйте повторно скопировать правильную по инструкции или введите /exit для выхода"
        );
        return await ctx.scene.reenter();
      }
    });
    tinkoff.leave((ctx) => (ctx.context = {}));
    return tinkoff;
  }
}

module.exports = SceneGenerator;
