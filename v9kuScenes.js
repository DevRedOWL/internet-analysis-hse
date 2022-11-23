import { Scenes } from 'telegraf';
import { timeFormatConfig } from './v9kuService.js';

export default class SceneBuilder {
  EventCreateScene() {
    const eventScene = new Scenes.BaseScene('create');

    const actionEnum = {
      EDIT_MENU: 'create_event_menu',
      EDIT_DATE: 'create_event_date',
      EDIT_TEAM: 'create_event_team',
      EDIT_LINK: 'create_event_link',
      SAVE_EVENT: 'create_event_save',
    };

    eventScene.enter((ctx) => {
      if (!ctx.session.createEvent) {
        ctx.session.createEvent = { step: actionEnum.EDIT_MENU, teams: [] };
      } else {
        ctx.session.createEvent.step = actionEnum.EDIT_MENU;
      }

      const event = ctx.session.createEvent;
      ctx.reply('Вы вошли в режим создания мероприятия', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `📅 ${
                  event.date
                    ? event.date.toLocaleString('ru-RU', timeFormatConfig)
                    : 'Изменить дату'
                }`,
                callback_data: actionEnum.EDIT_DATE,
              },
              {
                text: `${
                  event.teams[1] && event.teams[2]
                    ? event.teams[1] + ' - ' + event.teams[2]
                    : '👥 Изменить команду'
                }`,
                callback_data: actionEnum.EDIT_TEAM,
              },
            ],
            [
              {
                text: `🔗 ${event.url ? event.url : 'Изменить ссылку'}`,
                callback_data: actionEnum.EDIT_LINK,
              },
              { text: '✅ Сохранить событие', callback_data: actionEnum.SAVE_EVENT },
            ],
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
        'Отправьте названия двух команд по очереди\n\nРекомендуется использовать флаги: \n🇷🇺 Спартак - 🇷🇺 Зенит',
      );
      await ctx.reply('Отправьте название первой команды');
    });
    eventScene.action(actionEnum.EDIT_LINK, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_LINK;
      await ctx.editMessageText('Отправьте полную ссылку на матч');
    });
    eventScene.action(actionEnum.SAVE_EVENT, async (ctx) => {
      ctx.session.createEvent.step = actionEnum.SAVE_EVENT;
      if (
        !isNaN(ctx.session.createEvent.date) &&
        ctx.session.createEvent.teams[1] &&
        ctx.session.createEvent.teams[2]
      ) {
        await ctx.reply('Событие сохранено');
        ctx.session.createEvent = null;
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
        case actionEnum.EDIT_LINK:
          ctx.session.createEvent.url = url.trim();
          await ctx.reply('Ссылка сохранена');
          await ctx.scene.reenter();
          break;
        case actionEnum.SAVE_EVENT:
          break;
        default:
          ctx.replyWithMarkdown('Вы ничего не выбрали, для выхода введите ```/exit```');
          await ctx.scene.reenter();
          break;
      }

      /* try {
        // Пытаемся создать
        // return await ctx.scene.leave();
      } catch (ex) {
        console.log(ex);
        ctx.reply('Что-то пошло не так');
        return await ctx.scene.reenter();
      } */
    });

    eventScene.leave((ctx) => {});

    return eventScene;
  }
}
