const express = require("express");
const textAnalyzer = require("./textAnalyzer");
const filmScrapper = require("./filmScrapper");

const app = express();
app.use(express.json({ extended: true }));

app.post("/tonal", async function (req, res) {
  const { text } = req.body;
  const analysis = await textAnalyzer.tonal(text, true);

  // Возвращаем ответ
  res.status(200).json(analysis);
});

app.post("/frequrency", async function (req, res) {
    const { text, compression = 0 } = req.body;
    const analysis = await textAnalyzer.freqDictionary(text, compression);
  
    // Возвращаем ответ
    res.status(200).json(analysis);
  });

app.post("/reviews", async function (req, res) {
  // Обрабатываем фильм
  const { name } = req.body;
  console.log("Finding films...");
  const foundFilms = await filmScrapper.getFilmsByName(name);
  console.log(`Found ${foundFilms.length} films, getting reviews...`);
  const filmReviews = await filmScrapper.getReviewsByUrl(foundFilms[0].url);
  console.log(`Found ${filmReviews.length} reviews, analyzing...`);
  const analyzedReviews = await Promise.all(
    filmReviews.map(async (review) => {
      return {
        stars: review.stars,
        ...(await textAnalyzer.tonal(review.text, true)),
      };
    })
  );
  console.log("Done");
  
  const totalScore = {
    stars:
      filmReviews
        .map((i) => i.stars)
        .reduce(function (acc, curr) {
          return acc + curr;
        }, 0) / filmReviews.length,
    reviews:
      analyzedReviews
        .map((i) => i.score)
        .reduce(function (acc, curr) {
          return acc + curr;
        }, 0) / analyzedReviews.length,
  };

  // Возвращаем ответ
  const analysis = {
    totalScore,
    analyzedReviews,
    filmReviews,
    foundFilms,
  };
  res.status(200).json(analysis);
});

module.exports = app;
