const natural = require("natural");
const aposToLexForm = require("apos-to-lex-form");
const SpellCorrector = require("spelling-corrector");
const SW = require("stopword");
const translate = require("translatte");

const spellCorrector = new SpellCorrector();
spellCorrector.loadDictionary();

module.exports = {
  translate: async function (text, toTranslate = false) {
    try {
      return {
        translation: toTranslate
          ? (
              await translate(text.replace(/[^a-zA-Zа-яА-Я\s]+/g, ""), {
                to: "en",
              })
            ).text
          : text,
        translationError: false,
      };
    } catch (error) {
      return { translation: text, translationError: true };
    }
  },

  freqDictionary: async function (text, compression = 0) {
    // Пытаемся перевести текст
    let { translation } = await this.translate(text);

    // Избавляемся от сокращений, конвертируем в нижний регистр и удаляем лишние символы
    const lexedText = aposToLexForm(translation);

    // Токенизация и фильтрация
    const { WordTokenizer, SentenceTokenizer } = natural;
    // По словам
    const wordTokenizer = new WordTokenizer();
    const wordTokens = wordTokenizer.tokenize(lexedText);
    const wordFilter = SW.removeStopwords(wordTokens);
    // По предложениям
    const sentenceTokenizer = new SentenceTokenizer();
    const sentenceTokens = sentenceTokenizer.tokenize(lexedText);
    const sentenceFilter = SW.removeStopwords(sentenceTokens);

    // Рассчитываем частоту слов
    let wordFrequrency = {};
    for (let i = 0; i < wordFilter.length; i++) {
      wordFrequrency[wordFilter[i]] = (wordFrequrency[wordFilter[i]] || 0) + 1;
    }

    // Рассчитываем веса предложений
    const { PorterStemmer } = natural;
    let sentenceWeight = {};
    for (let i = 0; i < sentenceFilter.length; i++) {
      const stemmedSentence = PorterStemmer.stem(sentenceFilter[i]);
      const sentenceWords = wordTokenizer.tokenize(stemmedSentence);
      //const uniqueWords = sentenceWords.filter((v, i, a) => a.indexOf(v) === i);
      sentenceWeight[sentenceFilter[i]] = sentenceWords.reduce(
        (acc, th) => acc + (wordFrequrency[th] || 0),
        0
      );
    }

    // Сортируем по убыванию веса
    const sortedSentences = Object.entries(sentenceWeight)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    // Применяем процент сжатия
    const len = Object.keys(sortedSentences).length;
    const compressedText =
      compression > 0 && compression <= 100
        ? Object.entries(sortedSentences)
            .map((i) => i[0])
            .slice(0, Math.round(len - (compression / 100) * len))
        : null;

    return {
      wordFilter,
      wordFrequrency,
      sentenceFilter,
      sentenceWeight,
      sortedSentences,
      compressedText,
    };
  },

  tonal: async function (text, toTranslate = false) {
    // Пытаемся перевести текст
    let { translation, translationError } = await this.translate(
      text,
      toTranslate
    );

    // Избавляемся от сокращений, конвертируем в нижний регистр и удаляем лишние символы
    const lexedText = aposToLexForm(translation);
    const casedReview = lexedText.toLowerCase();
    const alphaOnlyReview = casedReview.replace(/[^a-zA-Zа-яА-Я\s]+/g, "");

    // Разбиваем текст на индивидуальные составляющие
    const { WordTokenizer } = natural;
    const tokenizer = new WordTokenizer();
    const tokenizedReview = tokenizer.tokenize(alphaOnlyReview);

    // Исправляем орфографию
    // tokenizedReview.forEach((word, index) => {
    //   tokenizedReview[index] = spellCorrector.correct(word);
    // });

    // Фильтруем стопслова
    const filteredReview = SW.removeStopwords(tokenizedReview);

    // Выполняем анализ тональности с учетом стемминга (нормализации формы слов)
    const { SentimentAnalyzer, PorterStemmer } = natural;
    const analyzerEN = new SentimentAnalyzer("English", PorterStemmer, "afinn");
    const score = analyzerEN.getSentiment(filteredReview);

    // Возвращаем ответ
    return {
      score,
      text,
      translation,
      translationError,
    };
  },
};
