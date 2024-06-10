import { Scenes } from 'telegraf';
import { timeFormatConfig, countReward, matchCaptionBuilder } from './v9ku.service.js';
import { V9kuMatch, V9kuUser, V9kuMessage, V9kuVote, Op, sequelize } from './v9ku.db.js';
import { v9kuEventScheduler } from './v9ku.eventScheduler.js';

export default class SceneBuilder {
  EventCreateScene() {
    const eventScene = new Scenes.BaseScene('create_match');

    const actionEnum = {
      EDIT_MENU: 'create_event_menu',
      EDIT_DATE: 'create_event_date',
      EDIT_TEAM: 'create_event_team',
      EDIT_COEF: 'create_event_coef',
      EDIT_URL: 'create_event_url',
      SAVE_EVENT: 'create_event_save',
    };

    eventScene.enter((ctx) => {
      if (!ctx.session.createEvent) {
        ctx.session.createEvent = { step: actionEnum.EDIT_MENU, teams: [] };
      } else {
        ctx.session.createEvent.step = actionEnum.EDIT_MENU;
      }

      const event = ctx.session.createEvent;
      ctx.reply('Редактирование мероприятия', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `📅 ${
                  event.date
                    ? new Date(event.date).toLocaleString('ru-RU', timeFormatConfig)
                    : 'Изменить дату'
                }`,
                callback_data: actionEnum.EDIT_DATE,
              },
              {
                text: `${
                  event.teams[1] && event.teams[2]
                    ? event.teams[1] + ' - ' + event.teams[2]
                    : '👥 Изменить команды'
                }`,
                callback_data: actionEnum.EDIT_TEAM,
              },
            ],
            [
              {
                text: `${event.coef ? '💯 Коэфициент: ' + event.coef : '💯 Коэфициент: 1.0'}`,
                callback_data: actionEnum.EDIT_COEF,
              },
              {
                text: `🔗 ${event.url ? event.url : 'Изменить ссылку'}`,
                callback_data: actionEnum.EDIT_URL,
              },
            ],
            [{ text: '✅ Сохранить событие', callback_data: actionEnum.SAVE_EVENT }],
          ],
        },
      });
    });

    eventScene.action(actionEnum.EDIT_DATE, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_DATE;
      await ctx.editMessageText(
        'Отправьте дату матча в ответном сообщении в формате\nПример: 2022-09-19 16:30\n\nВремя устанавливается по мск.',
      );
    });
    eventScene.action(actionEnum.EDIT_TEAM, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_TEAM;
      ctx.session.createEvent.teams = [];
      await ctx.editMessageText(
        'Отправьте названия двух команд по очереди\nРекомендуется использовать флаги, например: 🇷🇺 Амкар',
      );
      await ctx.reply('Отправьте название первой команды');
    });
    eventScene.action(actionEnum.EDIT_COEF, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_COEF;
      await ctx.editMessageText('Отправьте коэфициент очков за данный матч в виде дробного числа');
    });
    eventScene.action(actionEnum.EDIT_URL, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_URL;
      await ctx.editMessageText('Отправьте полную ссылку на матч');
    });
    eventScene.action(actionEnum.SAVE_EVENT, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.SAVE_EVENT;
      if (
        !isNaN(new Date(ctx.session.createEvent.date)) &&
        ctx.session.createEvent.teams[1] &&
        ctx.session.createEvent.teams[2]
      ) {
        const t = await sequelize.transaction();
        const matchData = await V9kuMatch.create(
          {
            date: new Date(ctx.session.createEvent.date),
            team1: ctx.session.createEvent.teams[1],
            team2: ctx.session.createEvent.teams[2],
            coef: ctx.session.createEvent.coef || 1.0,
            url: ctx.session.createEvent.url,
          },
          { transaction: t },
        );
        // Заносим событие в календарь
        await v9kuEventScheduler.scheduleEvents(matchData);

        const caption = `Команды: ${matchData.team1} - ${matchData.team2}
Время: ${matchData.date.toLocaleString('ru-RU', timeFormatConfig)} мск.
${matchData.url ? 'Ссылка: ' + matchData.url : ''}`;

        // FIXME: Рассылка матча
        try {
          const users = await V9kuUser.findAll({ where: { enabled: true } });

          // Если осталось менее, чем 28 часов до матча
          if (new Date() > new Date(matchData.date.getTime() - 28 * 60 * 60 * 1000)) {
            for (let user of users) {
              try {
                const caption = matchCaptionBuilder(user.name, matchData);
                const message = await ctx.telegram.sendMessage(user.userId, caption.text, {
                  reply_markup: {
                    inline_keyboard: [caption.buttons],
                  },
                });
                await V9kuMessage.create(
                  {
                    messageId: message.message_id,
                    userId: user.userId,
                    matchId: matchData.id,
                  },
                  { transaction: t },
                );
              } catch (ex) {
                console.log(ex);
                await V9kuUser.update({ enabled: false }, { where: { userId: user.userId } });
                console.log(`Blocked user ${user.userId}`);
              }
            }
          }
          await t.commit();
          await ctx.editMessageText(`🏆 Матч сохранен!\n\n${caption}`);
          ctx.session.createEvent = null;
        } catch (ex) {
          await t.rollback();
          ctx.reply('Ошибка при рассылке');
          console.log(ex);
        }

        return await ctx.scene.leave();
      } else {
        await ctx.reply('Не все необходимые поля заполнены');
      }
    });

    eventScene.on('text', async (ctx) => {
      const url = ctx.message.text;
      if (url === '/exit') {
        ctx.reply('Вы вышли из режима создания мероприятия');
        ctx.session.createEvent = null;
        return await ctx.scene.leave();
      }

      switch (ctx.session.createEvent.step) {
        case actionEnum.EDIT_DATE:
          const formattedDate = new Date(url.trim().split(' ').join('T') + '+03:00');
          if (isNaN(formattedDate) || formattedDate < new Date()) {
            await ctx.reply(`Формат даты неверный или вы пытаетесь создать матч в прошлом`);
            return await ctx.scene.reenter();
          }
          ctx.session.createEvent.date = formattedDate;
          await ctx.reply(
            `Дата установлена: ${formattedDate.toLocaleString('ru-RU', timeFormatConfig)}`,
          );
          await ctx.scene.reenter();
          break;
        case actionEnum.EDIT_TEAM:
          if (!ctx.session.createEvent.teams[1]) {
            ctx.session.createEvent.teams[1] = url.trim();
            ctx.reply('Отправьте название второй команды');
          } else {
            ctx.session.createEvent.teams[2] = url.trim();
            ctx.reply(
              `Команды сохранены: ${ctx.session.createEvent.teams[1]} - ${ctx.session.createEvent.teams[2]}`,
            );
            await ctx.scene.reenter();
          }
          break;
        case actionEnum.EDIT_COEF:
          const coef = Number(url.trim().split(',').join('.'));
          if (isNaN(coef) || coef <= 0) {
            await ctx.reply('Неверное значение');
            return await ctx.scene.reenter();
          }
          ctx.session.createEvent.coef = Number(coef);
          await ctx.reply('Коэфициент сохранен');
          await ctx.scene.reenter();
          break;
        case actionEnum.EDIT_URL:
          ctx.session.createEvent.url = url.trim();
          await ctx.reply('Ссылка сохранена');
          await ctx.scene.reenter();
          break;
        default:
          ctx.reply('Вы ничего не выбрали, для выхода введите /exit');
          await ctx.scene.reenter();
          break;
      }
    });

    eventScene.leave((ctx) => {});

    return eventScene;
  }

  ScoreSetScene() {
    const scoreScene = new Scenes.BaseScene('set_score');

    scoreScene.enter(async (ctx) => {
      const matchData = await V9kuMatch.findOne({
        where: { score: null, date: { [Op.lte]: new Date() } },
        order: [['date', 'ASC']],
      });
      if (!matchData) {
        await ctx.reply('Больше не осталось матчей без счета, для выхода введите /exit');
        ctx.session.currentEvent = undefined;
        return await ctx.scene.leave();
      }
      ctx.session.currentEvent = matchData.id;
      const caption = `Команды: ${matchData.team1} - ${matchData.team2}
Время: ${matchData.date.toLocaleString('ru-RU', timeFormatConfig)} мск.
${matchData.url ? 'Ссылка: ' + matchData.url : ''}`;
      ctx.reply(`${caption}\nВведите счет для этого матча в формате 2:5, либо 2-5`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `Вернуться в меню`,
                callback_data: 'EXIT_MENU',
              },
            ],
          ],
        },
      });
    });

    scoreScene.action('EXIT_MENU', async (ctx) => {
      await ctx.reply('Вы вышли из режима ввода очков');
      ctx.session.currentEvent = undefined;
      return await ctx.scene.leave();
    });

    scoreScene.on('text', async (ctx) => {
      const url = ctx.message.text.trim();
      if (ctx.session.currentEvent === undefined || url === '/exit') {
        ctx.reply('Вы вышли из режима ввода очков');
        ctx.session.currentEvent = undefined;
        return await ctx.scene.leave();
      }

      // FIXME: Установка очков
      const score = url.split(/\:|-/);
      const t = await sequelize.transaction();
      if (score.length === 2 && Number(score[0]) >= 0 && Number(score[1]) >= 0) {
        try {
          const [, [updatedEvent]] = await V9kuMatch.update(
            { score: score },
            {
              where: {
                id: ctx.session.currentEvent,
              },
              transaction: t,
              returning: true,
            },
          );
          const votes = await V9kuVote.findAll({
            where: { matchId: updatedEvent.id },
            transaction: t,
          });
          for (let vote of votes) {
            const rawReward = countReward(vote, score);
            const reward = rawReward * updatedEvent.coef;
            await V9kuUser.update(
              {
                score: sequelize.literal(`score + ${reward}`),
                perfect: sequelize.literal(`perfect + ${rawReward === 4 ? 1 : 0}`),
              },
              { where: { userId: vote.userId }, returning: true, transaction: t },
            );
            ctx.telegram
              .sendMessage(
                vote.userId,
                `Вы получили ${reward} очков за матч ${updatedEvent.team1} - ${updatedEvent.team2}\nСчет: ⚽ ${updatedEvent.score[0]} - ${updatedEvent.score[1]}`,
              )
              .catch((ex) => {
                console.log(`Unable to deliver message to ${vote.userId}`, ex);
              });
          }
          await t.commit();
        } catch (ex) {
          await ctx.reply(`Не удалось выдать награды за прогноз`);
          console.log(ex);
          await ctx.scene.reenter();
          await t.rollback();
        }
        await ctx.reply(`Счет установлен: ${score[0]} – ${score[1]}`);
        return await ctx.scene.reenter();
      } else {
        ctx.reply(`Счет неверный`);
        return await ctx.scene.reenter();
      }
    });

    scoreScene.leave((ctx) => {});

    return scoreScene;
  }

  SendingScene() {
    const sendngScene = new Scenes.BaseScene('sending');

    sendngScene.enter((ctx) => {
      ctx.reply(`Введите сообщение для рассылки или /exit для выхода`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `Вернуться в меню`,
                callback_data: 'EXIT_MENU',
              },
            ],
          ],
        },
      });
    });

    sendngScene.action('EXIT_MENU', async (ctx) => {
      await ctx.reply('Вы вышли из режима рассылки');
      return await ctx.scene.leave();
    });

    sendngScene.on('text', async (ctx) => {
      const msg = ctx.message.text;
      if (msg === '/exit') {
        ctx.reply('Вы вышли из режима рассылки');
        return await ctx.scene.leave();
      }

      try {
        const users = await V9kuUser.findAll({ where: { enabled: true } });
        for (let user of users) {
          try {
            await ctx.telegram.sendMessage(user.userId, '⚡ Рассылка от администратора\n\n' + msg);
          } catch (ex) {
            await V9kuUser.update({ enabled: false }, { where: { userId: user.userId } });
            console.log(`Blocked user ${user.userId}`);
          }
        }
        ctx.replyWithMarkdown(
          `*Сообщение успешно отправлено ${users.length} пользователям:*\n\n${msg}`,
        );
      } catch (ex) {
        ctx.reply('Ошибка при рассылке');
        console.log(ex);
      }
      return await ctx.scene.leave();
    });

    sendngScene.leave((ctx) => {});

    return sendngScene;
  }
}
