import path from 'path';
import { ForrumProfessionalStatus } from './forrum.enum.js';

export const professionalStatusMarkup = [
  'Чтобы направить вас в наиболее подходящую группу, нам необходимо познакомиться. Пожалуйста, выберите свой статус, нажав на одну из кнопок ниже, либо отправьте нам кодовое слово в ответном сообщении, если оно у вас есть:',
  {
    reply_markup: {
      inline_keyboard: Object.entries(ForrumProfessionalStatus).map((status) => {
        return [{ text: status[1], callback_data: `STATUS_${status[0]}` }];
      }),
    },
  },
];

export async function profileOffer(ctx) {
  await ctx.telegram.sendMessage(
    ctx.from.id,
    `Остался последний шаг, прежде чем вы станете частью сообщества FORRUM 💪
Чтобы начать взаимодействие с платформой, предлагаем вам заполнить ваш профиль. После одобрения администратором он будет опубликован в канале и другие участники смогут узнать вас лучше. В дальнейшем вы всегда сможете отредактировать ваш профиль.
Ниже вы можете ознакомиться с отличным примером профиля - основателя FORRUM Дмитрия Томчука
  `,
    {},
  );
  await ctx.telegram.sendPhoto(
    ctx.from.id,
    { source: path.join('./forrum/', 'forrum.profile.png') },
    {
      caption:
        'Хотите заполнить профиль? \n\nПример:\nВот он - настоящий бизнесмен, а внутри много много текста, мало фото',
    },
  );
  return await ctx.telegram.sendMessage(
    ctx.from.id,
    'Если вы готовы приступать, нажмите кнопку “Заполнить профиль”. Если у вас есть какие-то вопросы относительно заполнения профиля, вы можете обратиться к @kolupaevayana',
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Заполнить профиль', callback_data: 'profile' }]],
      },
    },
  );
}

export function getPrices() {
  return '[СТОИМОСТЬ УЧАСТИЯ] [ОФФЕР], \n\nГотовы двигаться дальше?';
}
