const axios = require("axios");
const { JSDOM } = require("jsdom");

const HOST = "https://irecommend.ru";

module.exports = {
  getReviewsByUrl: async (url) => {
    // Получаем данные с сайта и преобразовываем в виртуальное DOM
    const response = (await axios.get(url)).data;
    const { document: filmPage } = new JSDOM(response).window;

    // Выполняем query запрос к HTML странице, форматируя отзывы в строки
    const reviews = [].slice
      .call(filmPage.getElementsByClassName("list-comments")[0].children)
      .map((item) => {
        return {
            stars: item.getElementsByClassName("on").length,
            text: item.getElementsByClassName("reviewTeaserText")[0].innerHTML,
        };
      });

    return reviews;
  },

  getFilmsByName: async (name) => {
    const searchUrl = `${HOST}/srch`;

    // Получаем данные с сайта и преобразовываем в виртуальное DOM
    const response = (
      await axios.get(searchUrl, { params: { query: `${name} фильм` } })
    ).data;
    const { document: rawSearchResults } = new JSDOM(response).window;

    // Выполняем query запрос к HTML странице, форматируя результаты поиска
    const searchResults = [].slice
      .call(rawSearchResults.querySelectorAll(".srch-result-nodes li>div"))
      .map((item) => {
        return {
          title: item.children[0].children[0].innerHTML,
          url: HOST + item.children[4].href,
        };
      });

    return searchResults;
  },
};
