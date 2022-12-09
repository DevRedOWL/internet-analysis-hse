import { Scenes } from 'telegraf';

export default class SceneBuilder {
  ProfileScene() {
    const scoreScene = new Scenes.BaseScene('profile');

    scoreScene.enter(async (ctx) => {

      ctx.reply(`Редактирование профиля`, {
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


    });

    scoreScene.leave((ctx) => { });

    return scoreScene;
  }

}
