import { Scenes, Markup } from 'telegraf';
import { V9kuUser, Op } from './v9kuDb.js';
import { admin } from './config.js';

export default class SceneBuilder {
  EventCreateScene() {
    const eventScene = new Scenes.BaseScene('create');

    const actionEnum = {
      EDIT_DATE: 'create_event_date',
      EDIT_TEAM: 'create_event_team',
      EDIT_LINK: 'create_event_link',
    };

    eventScene.enter((ctx) => {
      ctx.reply(
        'Добро пожаловать в режим создания мероприятия',
        Markup.inlineKeyboard([
          Markup.callbackButton('Изменить дату', actionEnum.EDIT_DATE),
          Markup.callbackButton('Изменить команды', actionEnum.EDIT_TEAM),
          Markup.callbackButton('Изменить ссылку', actionEnum.EDIT_LINK),
        ]).extra(),
      );
    });

    eventScene.action(actionEnum.EDIT_DATE, (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_DATE;
      ctx.editMessageText('Отправьте в этом сообщении дату');
      // Потом сделать reenter
    });
    eventScene.action(actionEnum.EDIT_TEAM, (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_TEAM;
    });
    eventScene.action(actionEnum.EDIT_LINK, (ctx) => {
      ctx.session.createEvent.step = actionEnum.EDIT_LINK;
    });

    eventScene.on('text', async (ctx) => {
      const url = ctx.message.text;
      if (url === '/exit') {
        ctx.reply('Вы вышли из режима создания мероприятия');
        return await ctx.scene.leave();
      }

      try {
        // Пытаемся создать
        await user.save();
        ctx.reply(
          `Данные координат сохранены\n${
            user.enabled ? 'Все готово, ожидайте рассылку' : 'Не забудьте установить валюту'
          }`,
        );
        return await ctx.scene.leave();
      } catch (ex) {
        console.log(ex);
        ctx.reply('Что-то пошло не так');
        return await ctx.scene.reenter();
      }
    });

    eventScene.leave((ctx) => (ctx.context = {}));

    return eventScene;
  }
}
