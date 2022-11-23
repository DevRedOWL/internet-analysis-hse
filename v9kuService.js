import { V9kuMatch, V9kuMessage, Op } from './v9kuDb.js';

export const scoreButtonsBuilder = (team1, team2, selectedButton = { 1: null, 2: null }) => {
  const generatedButtons = [
    [{ text: `${team1}`, callback_data: 'team1_caption' }],
    [],
    [{ text: `${team2}`, callback_data: 'team2_caption' }],
    [],
    [
      {
        text: `${selectedButton[1] && selectedButton[2] ? '✅' : '❎'} Сохранить прогноз`,
        callback_data: 'confirm_prediction',
      },
    ],
  ];
  // Generating first row
  for (let i = 0; i <= 6; i++) {
    const action1Name = `team1_${i}`;
    const actionText = `${i < 6 ? i : '6+'}`;
    generatedButtons[1].push({
      text: selectedButton[1] === i ? `⚽${actionText}` : actionText,
      callback_data: action1Name,
    });
    const action2Name = `team2_${i}`;
    generatedButtons[3].push({
      text: selectedButton[2] === i ? `⚽${actionText}` : actionText,
      callback_data: action2Name,
    });
  }
  return generatedButtons;
};

export const timeFormatConfig = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timezone: 'Russia/Moscow',
};

export const matchCaptionBuilder = (userName, matchData) => {
  return {
    buttons: [
      { text: 'Голосовать', callback_data: 'predict' },
      matchData.url
        ? {
            text: `Ссылка на матч`,
            url: matchData.url,
          }
        : {
            text: 'Ссылка недоступна',
            url: 'tg://resolve?domain=V9KU_bot',
          },
    ],
    text: `Привет, ${userName}

Матч ${matchData.team1} - ${matchData.team2}
Состоится ${matchData.date.toLocaleString('ru-RU', timeFormatConfig)} мск.`,
  };
};

export const votedCaptionBuilder = (userName, matchData, voteData) => {
  const { url, team1, team2 } = matchData;
  return {
    buttons: [
      url
        ? {
            text: `Ссылка на матч`,
            url: url,
          }
        : {
            text: 'Ссылка недоступна',
            url: 'tg://resolve?domain=V9KU_bot',
          },
    ],
    text: `${userName}, ваш прогноз ⚽ ${voteData.team1 >= 0 ? voteData.team1 : '6+'} - ${
      voteData.team2 >= 0 ? voteData.team2 : '6+'
    }
Для матча ${team1} - ${team2}

  
Результаты после ${matchData.date.toLocaleString('ru-RU', timeFormatConfig)} мск.`,
  };
};

export const extractMessageContext = async (ctx) => {
  const messageData = await V9kuMessage.findOne({
    where: { messageId: ctx.callbackQuery.message.message_id },
  });
  const matchData = await V9kuMatch.findOne({
    where: { id: messageData.matchId },
  });
  return { messageData, matchData };
};
