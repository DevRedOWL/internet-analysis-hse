import { Scenes } from 'telegraf';

export default class SceneBuilder {
  ProfileScene() {
    const profileScene = new Scenes.BaseScene('profileScene');

    profileScene.enter(async (ctx) => {
      ctx.editMessageText(`Редактирование профиля`, {
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

    profileScene.action('EXIT_MENU', async (ctx) => {
      await ctx.editMessageText('Вы вышли из редактирования профиля', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Вернуться к редактированию', callback_data: 'profile' }]],
        },
      });
      ctx.session.profile = undefined;
      return await ctx.scene.leave();
    });

    profileScene.on('text', async (ctx) => {
      const url = ctx.message.text.trim();
    });

    profileScene.leave((ctx) => {});

    return profileScene;
  }
}
