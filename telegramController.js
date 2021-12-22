filmScrapper = require("./filmScrapper");
const { Telegraf, Extra, Markup, Scenes, session } = require("telegraf");

module.exports = {
  noButton: Markup.removeKeyboard(),
  handleFilms: async (ctx, text) => {
    const films = ctx.session.films;
    const foundFilm = films.filter((i) => i.title === text);
    if (foundFilm.length) {
      const reviews = await filmScrapper.getReviewsByUrl(foundFilm[0].url);
      // Считаем звездочки
      let resultStars = "☆☆☆☆☆";
      const stars =
        reviews
          .map((i) => i.stars)
          .reduce(function (acc, curr) {
            return acc + curr;
          }, 0) / reviews.length;
      for (let i = 0; i < stars - 1; i++) {
        resultStars =
          resultStars.substring(0, i) + "★" + resultStars.substring(i + 1);
      }
      let resultReviews =
        reviews
          .map(
            (r) =>
              `${r.stars > 3 ? "👍" : r.stars < 3 ? "👎" : "👌"}\n${r.text}`
          )
          .join("\n\n")
          .substring(0, 3800) + "\n\nЧитать отзывы на сайте:";
      await ctx.reply(
        `${foundFilm[0].title}\nРейтинг: ${resultStars}
            \n${resultReviews}\n${foundFilm[0].url}`,
        this.noButton
      );
    } else {
      await ctx.reply("Такой фильм не найден", this.noButton);
    }
  },
};
