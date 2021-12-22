const { Scenes, Markup } = require("telegraf");
const filmScrapper = require("./filmScrapper");

class SceneGenerator {
  ReviewsScene() {
    const reviews = new Scenes.BaseScene("reviews");
    reviews.enter((ctx) =>
      ctx.reply("Введите название фильма для получения отзывов")
    );
    reviews.on("text", async (ctx) => {
      const filmName = ctx.message.text;
      if (!ctx.callbackQuery?.data && filmName) {
        const films = await filmScrapper.getFilmsByName(filmName);
        if (films.length === 0) {
          await ctx.reply("Не найдено ни одного фильма по данному запросу");
          await ctx.scene.reenter();
        }
        const buttons = films.map((film) => [film.title]);
        ctx.session = { films };
        await ctx.reply(
          `Вот список фильмов по вашему запросу:`,
          Markup.keyboard(buttons).oneTime().resize()
        );
        await ctx.scene.leave();
      } else {
        await ctx.reply("Введите корректное название фильма");
        await ctx.scene.reenter();
      }
    });
    reviews.leave((ctx) => (ctx.context = {}));
    return reviews;
  }
}

module.exports = SceneGenerator;
