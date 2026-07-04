import { V9kuMatch, V9kuMessage, V9kuUser, V9kuVote } from './v9ku.db.js';
import { admins } from '../config.js';
import { markdownTable } from 'markdown-table';
import { escapers } from '@telegraf/entity';

const md = (text) => escapers.MarkdownV2(String(text ?? ''));

export const hasCompletedVote = (vote) =>
  vote && typeof vote.team1 === 'number' && typeof vote.team2 === 'number';

export const isMessageNotModified = (error) =>
  error?.response?.description?.includes('message is not modified') ||
  error?.message?.includes('message is not modified');

export const isActiveMatch = (matchData) =>
  matchData && !matchData.score && new Date() < new Date(matchData.date);

const parseMatchIdFromCallback = (data) => {
  if (!data) {
    return null;
  }
  if (data.startsWith('predict_')) {
    return Number(data.slice('predict_'.length));
  }
  if (data.startsWith('confirm_prediction_')) {
    return Number(data.slice('confirm_prediction_'.length));
  }
  if (data.startsWith('team1_caption_')) {
    return Number(data.slice('team1_caption_'.length));
  }
  if (data.startsWith('team2_caption_')) {
    return Number(data.slice('team2_caption_'.length));
  }

  const teamScoreMatch = data.match(/^team[12]_\d+_(\d+)$/);
  return teamScoreMatch ? Number(teamScoreMatch[1]) : null;
};

const syncUserMessageRecord = async (userId, matchId, messageId) => {
  const existing = await V9kuMessage.findOne({ where: { userId, matchId } });
  if (existing) {
    if (existing.messageId !== messageId) {
      await V9kuMessage.update({ messageId }, { where: { id: existing.id } });
    }
    return { ...existing, messageId, userId, matchId };
  }

  return V9kuMessage.create({ messageId, userId, matchId });
};

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
  const partialVoted = [];
  const notVoted = [];

  for (const user of enabledUsers) {
    const vote = votesByUserId.get(String(user.userId));
    if (hasCompletedVote(vote)) {
      votedRows.push([user.name || `ID ${user.userId}`, formatVoteScore(vote)]);
    } else if (vote) {
      partialVoted.push(user.name || `ID ${user.userId}`);
    } else {
      notVoted.push(user.name || `ID ${user.userId}`);
    }
  }

  votedRows.sort((a, b) => a[0].localeCompare(b[0], 'ru'));

  const header = `*Прогнозы:* ${md(matchData.team1)} \\- ${md(matchData.team2)}
*Дата:* ${matchData.date.toLocaleString('ru-RU', timeFormatConfig).replaceAll('.', '\\.')} мск
*Проголосовало:* ${votedRows.length}/${enabledUsers.length}`;

  const table =
    votedRows.length > 0
      ? markdownTable([['Имя', 'Счёт'], ...votedRows], { align: ['l', 'c'] })
      : 'Пока никто не проголосовал';

  let report = `${header}\n\n\`\`\`\n${table}\n\`\`\``;
  if (partialVoted.length) {
    report += `\n\n*Начали, но не завершили \\(${partialVoted.length}\\):*\n\`\`\`\n${partialVoted.join('\n')}\n\`\`\``;
  }
  if (notVoted.length) {
    report += `\n\n*Не проголосовали \\(${notVoted.length}\\):*\n\`\`\`\n${notVoted.join('\n')}\n\`\`\``;
  }

  return report;
}

export function buildRenameUsersTable(users) {
  const rows = users.map((user) => [
    String(user.id),
    user.name?.trim() || '—',
    user.phone || '—',
    String(user.userId),
  ]);

  return markdownTable([['ID', 'Имя', 'Телефон', 'TG ID'], ...rows], {
    align: ['r', 'l', 'l', 'r'],
  });
}

export function buildBumpUsersTable(users) {
  const rows = users.map((user) => [
    String(user.id),
    user.name?.trim() || '—',
    String(user.score),
    String(user.perfect),
    String(user.userId),
  ]);

  return markdownTable([['ID', 'Имя', 'Очки', 'Точных', 'TG ID'], ...rows], {
    align: ['r', 'l', 'r', 'r', 'r'],
  });
}

export function buildBumpScoreNotification(amount, newScore) {
  const scoreLabel = md(String(newScore));
  if (amount > 0) {
    return `Вам начислено *\\+${md(String(amount))}* очк\\.\nНовый счёт: *${scoreLabel}*`;
  }
  return `С вас списано *${md(String(Math.abs(amount)))}* очк\\.\nНовый счёт: *${scoreLabel}*`;
}

export function buildBumpPerfectNotification(newPerfect) {
  return `Вам засчитан точный прогноз\\.\nВсего точных: *${md(String(newPerfect))}*`;
}

export function buildRewardNotification(reward, team1, team2, score) {
  return `Вы получили ${md(String(reward))} очков за матч ${md(team1)} \\- ${md(
    team2,
  )}\nСчет: ⚽ ${md(String(score[0]))} \\- ${md(String(score[1]))}`;
}

export async function sendRewardNotifications(telegram, match, votes) {
  let sent = 0;
  let failed = 0;

  for (const vote of votes) {
    const rawReward = countReward(vote, match.score);
    const reward = rawReward * match.coef;
    try {
      await telegram.sendMessage(
        vote.userId,
        buildRewardNotification(reward, match.team1, match.team2, match.score),
        { parse_mode: 'MarkdownV2' },
      );
      sent++;
    } catch (ex) {
      failed++;
      console.log(`Unable to deliver reward notification to ${vote.userId}`, ex);
    }
  }

  return { sent, failed };
}

export function buildRatingList(users) {
  if (!users.length) {
    return '*Турнирная таблица*\n\nПока никто не участвует';
  }

  const lines = users.map((user, idx) => {
    const place = idx + 1;
    const name = md(user.name);
    const stats = `${md(String(user.score))} очк\\. · ${md(String(user.perfect))} точных`;

    if (place === 1) {
      return `🥇 *${name}* — ${stats}`;
    }
    if (place === 2) {
      return `🥈 *${name}* — ${stats}`;
    }
    if (place === 3) {
      return `🥉 *${name}* — ${stats}`;
    }
    return `${place}\\. *${name}* — ${stats}`;
  });

  return `*Турнирная таблица*\n\n${lines.join('\n')}`;
}

export function buildScoreReport(user, place) {
  return `*Ваши результаты*

*Общий счёт:* ${md(String(user.score))}
*Точных прогнозов:* ${md(String(user.perfect))}
*Место в рейтинге:* ${md(String(place))}`;
}

const removeMessageButtons = async (telegram, chatId, messageId) => {
  try {
    await telegram.editMessageReplyMarkup(chatId, messageId, undefined, {
      inline_keyboard: [],
    });
  } catch (ex) {
    console.log(
      `[${new Date().toLocaleString('ru-RU')}] [V9ku] Failed to remove buttons from message ${messageId}`,
      ex.message,
    );
  }
};

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
          await V9kuMessage.update(
            { messageId: message.message_id },
            { where: { id: existingMessage.id } },
          );
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

export const scoreButtonsBuilder = (
  team1,
  team2,
  matchId,
  selectedButton = { 1: null, 2: null },
) => {
  const generatedButtons = [
    [{ text: `${team1}`, callback_data: `team1_caption_${matchId}` }],
    [],
    [{ text: `${team2}`, callback_data: `team2_caption_${matchId}` }],
    [],
    [
      {
        text: `${
          typeof selectedButton[1] == 'number' && typeof selectedButton[2] == 'number' ? '✅' : '❎'
        } Сохранить прогноз`,
        callback_data: `confirm_prediction_${matchId}`,
      },
    ],
  ];
  // Generating first row
  for (let i = 0; i <= 6; i++) {
    const action1Name = `team1_${i}_${matchId}`;
    const actionText = `${i < 6 ? i : '6+'}`;
    generatedButtons[1].push({
      text: selectedButton[1] === i ? `⚽${actionText}` : actionText,
      callback_data: action1Name,
    });
    const action2Name = `team2_${i}_${matchId}`;
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
      { text: 'Голосовать', callback_data: `predict_${matchData.id}` },
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
    text: `Привет, ${md(userName)}

⚽ Матч ${md(matchData.team1)} \\- ${md(matchData.team2)}
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
  const messageId = ctx.callbackQuery.message.message_id;
  const userId = ctx.from.id;
  const callbackMatchId = parseMatchIdFromCallback(ctx.callbackQuery.data);

  let messageData = await V9kuMessage.findOne({ where: { messageId } });
  let matchId = messageData?.matchId ?? callbackMatchId;

  if (!matchId) {
    const userMessages = await V9kuMessage.findAll({
      where: { userId },
      order: [['id', 'DESC']],
    });
    const openMessages = [];
    for (const userMessage of userMessages) {
      const match = await V9kuMatch.findOne({ where: { id: userMessage.matchId } });
      if (isActiveMatch(match)) {
        openMessages.push(userMessage);
      }
    }

    if (openMessages.length === 1) {
      matchId = openMessages[0].matchId;
      messageData = await syncUserMessageRecord(userId, matchId, messageId);
    } else {
      return { messageData: null, matchData: null };
    }
  } else if (!messageData || messageData.messageId !== messageId) {
    messageData = await syncUserMessageRecord(userId, matchId, messageId);
  }

  const matchData = await V9kuMatch.findOne({ where: { id: matchId } });
  if (!matchData) {
    return { messageData: null, matchData: null };
  }

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

const formatNamesRu = (names) => {
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} и ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
};

export const isPerfectGuess = (vote, score) => countReward(vote, score) === 4;

export async function sendPerfectGuessAnnouncement(telegram, match, votes) {
  const perfectUserIds = votes.filter((vote) => isPerfectGuess(vote, match.score)).map((vote) => vote.userId);

  if (!perfectUserIds.length) {
    return { sent: 0, skipped: true };
  }

  const perfectUsers = await V9kuUser.findAll({
    where: { userId: perfectUserIds },
    order: [['name', 'ASC']],
  });
  const names = perfectUsers.map((user) => user.name?.trim()).filter(Boolean);

  if (!names.length) {
    return { sent: 0, skipped: true };
  }

  const message = `Поздравляем ${formatNamesRu(names.map(md))} с угадыванием счета матча 💪🏆🥇`;
  const users = await V9kuUser.findAll({ where: { enabled: true } });
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await telegram.sendMessage(user.userId, message, { parse_mode: 'MarkdownV2' });
      sent++;
    } catch (ex) {
      failed++;
      console.log(
        `[${new Date().toLocaleString('ru-RU')}] [V9ku] Failed to send perfect guess announcement to ${user.userId}`,
        ex.message,
      );
    }
  }

  return { sent, failed, skipped: false, total: users.length };
}

const commands = {
  admin: [
    { command: 'create_match', description: '[Админ] Создать матч' },
    { command: 'set_score', description: '[Админ] Завершить матч' },
    { command: 'resend_rewards', description: '[Админ] Переотправить уведомления' },
    { command: 'sending', description: '[Админ] Выполнить рассылку' },
    { command: 'remind', description: '[Админ] Напоминание о голосовании' },
    { command: 'votes', description: '[Админ] Прогнозы по матчу' },
    { command: 'rename', description: '[Админ] Переименовать участника' },
    { command: 'bump', description: '[Админ] Очки / точный прогноз' },
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
