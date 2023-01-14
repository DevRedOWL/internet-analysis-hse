import path from 'path';
import { Scenes } from 'telegraf';
import { ForrumProfile, ForrumUser } from './forrum.db.js';
import { ForrumProfileStatus, ForrumStep } from './forrum.enum.js';

export default class SceneBuilder {
  ProfileScene() {
    const profileScene = new Scenes.BaseScene('profileScene');

    profileScene.enter(async (ctx) => {
      const profile = await ForrumProfile.findOrCreate({ where: { userId: ctx.from.id } });
      if (!ctx.session.profile) {
        ctx.session.profile = profile[0];
      }
      await ctx.reply('Редактирование профиля', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `📷 Редактировать фото`, callback_data: 'EDIT_PHOTO' },
              { text: `📃 Редактировать текст`, callback_data: 'EDIT_TEXT' },
            ],
            [
              { text: `👤 Предпросмотр`, callback_data: 'PREVIEW_PROFILE' },
              { text: `⏪ Выйти из редактирования`, callback_data: 'EXIT_MENU' },
            ],
            [
              {
                text: `${
                  ctx.session.profile.photo && ctx.session.profile.text ? '✅' : '❎'
                } Отправить на модерацию`,
                callback_data: 'SUBMIT_PROFILE',
              },
            ],
          ],
        },
      });
    });

    profileScene.action('EDIT_TEXT', async (ctx) => {
      ctx.session.profile.step = 'EDIT_TEXT';
      return await ctx.editMessageText(
        'Пожалуйста, отправьте нам краткий рассказ о себе в ответном сообщении на примере профиля выше. \nРасскажите о ваших хобби, увлечениях, любимых вещах и классных проектах 😎',
        {
          reply_markup: {
            inline_keyboard: [[{ text: `Вернуться к редактированию`, callback_data: 'REENTER' }]],
          },
        },
      );
    });

    profileScene.action('EDIT_PHOTO', async (ctx) => {
      ctx.session.profile.step = 'EDIT_PHOTO';
      return await ctx.editMessageText(
        'А сейчас, пожалуйста, отправьте нам свою фотографию - это важно, потому что так другим участникам будет легче вас узнать в дальнейшем 👥',
        {
          reply_markup: {
            inline_keyboard: [[{ text: `Вернуться к редактированию`, callback_data: 'REENTER' }]],
          },
        },
      );
    });

    profileScene.action('PREVIEW_PROFILE', async (ctx) => {
      if (!ctx.session.profile.photo || !ctx.session.profile.text) {
        await ctx.editMessageText(
          'Кажется, ваш профиль не заполнен полностью: \nдополните его текстом или фотографией, чтобы мы могли разместить его в канале!',
        );
        return await ctx.scene.reenter();
      }
      await ctx.editMessageText('Отлично! Теперь ваш профиль будет выглядеть так:');
      await ctx.sendPhoto(
        { url: ctx.session.profile.photo },
        { caption: ctx.session.profile.text },
      );
      await ctx.scene.reenter();
    });

    profileScene.action('SUBMIT_PROFILE', async (ctx) => {
      if (!ctx.session.profile.photo || !ctx.session.profile.text) {
        await ctx.editMessageText(
          'Кажется, ваш профиль не заполнен полностью: \nдополните его текстом или фотографией, чтобы мы могли разместить его в канале!',
        );
        return await ctx.scene.reenter();
      }
      await ctx.editMessageText('Ваш профиль будет выглядеть так:');
      await ctx.sendPhoto(
        { url: ctx.session.profile.photo },
        { caption: ctx.session.profile.text },
      );
      await ctx.reply('Вы уверены, что хотите отправить профиль на модерацию?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отправить', callback_data: 'CONFIRM_PROFILE' }],
            [{ text: 'Вернуться к редактированию', callback_data: 'REENTER' }],
          ],
        },
      });
    });

    profileScene.action('CONFIRM_PROFILE', async (ctx) => {
      await ctx.editMessageText(
        `Отлично! Ваш профиль отправлен на модерацию. 
Мы постараемся обработать и разместить его как можно скорее!
Обратитесь в поддержку, если у вас остались вопросы о платформе или формате участия.
Будем на связи, команда FORRUM!🚀
    `,
        {},
      );
      await ForrumProfile.update(
        {
          text: ctx.session.profile.text,
          photo: ctx.session.profile.photo,
          status: ForrumProfileStatus.WAITING_FOR_REVIEW,
        },
        { where: { userId: ctx.from.id } },
      );
      await ForrumUser.update(
        {
          step: ForrumStep.VALIDATION,
        },
        { where: { userId: ctx.from.id } },
      );
      ctx.session.profile = undefined;
      return await ctx.scene.leave();
    });

    profileScene.action('REENTER', async (ctx) => {
      ctx.deleteMessage();
      return await ctx.scene.reenter();
    });

    profileScene.action('EXIT_MENU', async (ctx) => {
      await ForrumProfile.update(
        { text: ctx.session.profile.text, photo: ctx.session.profile.photo },
        { where: { userId: ctx.from.id } },
      );
      ctx.session.profile = undefined;
      await ctx.editMessageText('Вы вышли из редактирования профиля', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Вернуться к редактированию', callback_data: 'profile' }]],
        },
      });
      return await ctx.scene.leave();
    });

    profileScene.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      switch (ctx.session.profile.step) {
        case 'EDIT_TEXT':
          ctx.session.profile.text = text;
          await ctx.reply(`Текст сохранен!`);
          break;
        case 'EDIT_PHOTO':
          await ctx.reply(`Вы не отправили фотографию`);
          break;
      }
      ctx.session.profile.step = 'PREVIEW_PROFILE';
      ctx.scene.reenter();
    });

    profileScene.on('photo', async (ctx) => {
      switch (ctx.session.profile.step) {
        case 'EDIT_PHOTO':
          ctx.session.profile.photo = (
            await ctx.telegram.getFileLink(ctx.update.message.photo[2].file_id)
          ).toString();
          await ctx.reply(`Фотография сохранена!`);
          break;
      }
      ctx.session.profile.step = 'PREVIEW_PROFILE';
      ctx.scene.reenter();
    });

    profileScene.leave((ctx) => {});

    return profileScene;
  }
}
