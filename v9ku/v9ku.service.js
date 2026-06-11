import { V9kuMatch, V9kuMessage, V9kuUser, V9kuVote } from './v9ku.db.js';
import { admins } from '../config.js';
import { markdownTable } from 'markdown-table';

export const hasCompletedVote = (vote) =>
  vote && typeof vote.team1 === 'number' && typeof vote.team2 === 'number';

export const formatVoteScore = (vote) => {
  if (!hasCompletedVote(vote)) {
    return '—';
  }
  return `${vote.team1 >= 0 ? vote.team1 : '6+'} - ${vote.team2 >= 0 ? vote.team2 : '6+'}`;
};

export async function buildMatchVotesReport(matchData) {
  const [votes, enabledUsers] = await Promise.all([
    V9kuVote.findAll({ where: { matchId: matchData.id } }),
    V9kuUser.findAll({ where: { enabled: true }, order: [['name', 'ASC']] }),
  ]);

  const votesByUserId = new Map(votes.map((vote) => [String(vote.userId), vote]));
  const votedRows = [];
  const notVoted = [];

  for (const user of enabledUsers) {
    const vote = votesByUserId.get(String(user.userId));
    if (hasCompletedVote(vote)) {
      votedRows.push([
        user.name || `ID ${user.userId}`,
        formatVoteScore(vote),
        String(vote.team1 >= 0 ? vote.team1 : '6+'),
        String(vote.team2 >= 0 ? vote.team2 : '6+'),
      ]);
    } else {
      notVoted.push(user.name || `ID ${user.userId}`);
    }
  }

  votedRows.sort((a, b) => a[0].localeCompare(b[0], 'ru'));

  const header = `*Прогнозы:* ${matchData.team1} \\- ${matchData.team2}
*Дата:* ${matchData.date.toLocaleString('ru-RU', timeFormatConfig).replaceAll('.', '\\.')} мск
*Проголосовало:* ${votedRows.length}/${enabledUsers.length}`;

  const table =
    votedRows.length > 0
      ? markdownTable([['Имя', 'Счёт', matchData.team1, matchData.team2], ...votedRows], {
          delimiterStart: false,
          delimiterEnd: false,
        })
      : 'Пока никто не проголосовал';

  let report = `${header}\n\n\`\`\`\n${table}\n\`\`\``;
  if (notVoted.length) {
    report += `\n\n*Не проголосовали \\(${notVoted.length}\\):*\n\`\`\`\n${notVoted.join('\n')}\n\`\`\``;
  }

  return report;
}

export async function sendMatchReminders(telegram, event, { asNew = false } = {}) {
  const users = await V9kuUser.findAll({ where: { enabled: true } });
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const existingVote = await V9kuVote.findOne({
        where: { userId: user.userId, matchId: event.id },
      });
      if (hasCompletedVote(existingVote)) {
        skipped++;
        continue;
      }

      const existingMessage = await V9kuMessage.findOne({
        where: { userId: user.userId, matchId: event.id },
      });

      if (asNew || !existingMessage) {
        const caption = matchCaptionBuilder(user.name, event);
        const message = await telegram.sendMessage(user.userId, caption.text, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [caption.buttons],
          },
        });
        if (existingMessage) {
          await existingMessage.update({ messageId: message.message_id });
        } else {
          await V9kuMessage.create({
            messageId: message.message_id,
            userId: user.userId,
            matchId: event.id,
          });
        }
      } else {
        await telegram.sendMessage(
          user.userId,
          `Не забудьте сделать прогноз на матч ${event.team1} - ${event.team2}`,
          { reply_to_message_id: existingMessage.messageId },
        );
      }
      sent++;
    } catch (ex) {
      failed++;
      console.log(
        `[${new Date().toLocaleString('ru-RU')}] [V9ku] Failed to notify user ${user.userId}`,
        ex.message,
      );
    }
  }

  return { sent, skipped, failed, total: users.length };
}

export const scoreButtonsBuilder = (team1, team2, selectedButton = { 1: null, 2: null }) => {
  const generatedButtons = [
    [{ text: `${team1}`, callback_data: 'team1_caption' }],
    [],
    [{ text: `${team2}`, callback_data: 'team2_caption' }],
    [],
    [
      {
        text: `${
          typeof selectedButton[1] == 'number' && typeof selectedButton[2] == 'number' ? '✅' : '❎'
        } Сохранить прогноз`,
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
  timeZone: 'Europe/Moscow',
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

⚽ Матч ${matchData.team1} \\- ${matchData.team2}
Состоится ${matchData.date.toLocaleString('ru-RU', timeFormatConfig).replaceAll('.', '\\.')} мск\\.`,
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
  if (!messageData) {
    return { messageData: null, matchData: null };
  }
  const matchData = await V9kuMatch.findOne({
    where: { id: messageData.matchId },
  });
  return { messageData, matchData };
};

export const countReward = (vote, score) => {
  // Точно угадал счет
  if (vote.team1 === Number(score[0]) && vote.team2 === Number(score[1])) {
    return 4;
  }
  // Угадал разницу счетов, либо ничью
  else if (vote.team1 - vote.team2 === Number(score[0]) - Number(score[1])) {
    return 2;
  }
  // Угадал, что победила команда 1
  else if (vote.team1 > vote.team2 && Number(score[0]) > Number(score[1])) {
    return 1;
  }
  // Угадал, что победила команда 2
  else if (vote.team2 > vote.team1 && Number(score[1]) > Number(score[0])) {
    return 1;
  }
  // Совсем не угадал
  else {
    return 0;
  }
};

const commands = {
  admin: [
    { command: 'create_match', description: '[Админ] Создать матч' },
    { command: 'set_score', description: '[Админ] Завершить матч' },
    { command: 'sending', description: '[Админ] Выполнить рассылку' },
    { command: 'remind', description: '[Админ] Напоминание о голосовании' },
    { command: 'votes', description: '[Админ] Прогнозы по матчу' },
    { command: 'reset_commands', description: '[Админ] Сбросить кнопки' },
    { command: 'info', description: '[Админ] Техническая информация' },
  ],
  user: [
    { command: 'score', description: 'Мой счет' },
    { command: 'rating', description: 'Рейтинг' },
    { command: 'help', description: 'Инструкция' },
  ],
};

export function buildCommands(userId) {
  const adminCommands = admins.list.indexOf(userId) !== -1 ? commands.admin : [];
  return [...adminCommands, ...commands.user];
}

export function buildAllCommands() {
  return [...commands.user];
}
