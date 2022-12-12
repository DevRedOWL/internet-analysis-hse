import path from 'path';
import { ForrumStatus } from './forrum.enum.js';

export const professionalStatusMarkup = [
  'Подтвердите свой статус предпринимателя или введите кодовое слово',
  {
    reply_markup: {
      inline_keyboard: Object.entries(ForrumStatus).map((status) => {
        return [{ text: status[1], callback_data: `STATUS_${status[0]}` }];
      }),
    },
  },
];

export async function profileOffer(ctx) {
  await ctx.telegram.sendPhoto(
    ctx.from.id,
    { source: path.join('./forrum/', 'forrum.profile.png') },
    {
      caption:
        'Хотите заполнить профиль? \n\nПример:\nВот он - настоящий бизнесмен, а внутри много много текста, мало фото',
    },
  );
  return await ctx.telegram.sendMessage(ctx.from.id, 'Что нибудь про переход к заполнению', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Заполнить профиль', callback_data: 'profile' }]],
    },
  });
}
