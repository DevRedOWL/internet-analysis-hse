import scheduler from 'node-schedule';
import { V9kuMatch, V9kuUser, V9kuMessage, Op, V9kuVote } from './v9ku.db.js';
import { matchCaptionBuilder } from './v9ku.service.js';
import { V9kuTableRenderer } from './v9ku.table.js';

//V9kuTableRenderer.renderMatch(await V9kuMatch.findOne({ where: { id: 1 } }));

class EventScheduler {
  telegram = null;

  async init(telegram) {
    this.telegram = telegram.telegram;
    const futureMatches = await V9kuMatch.findAll({
      where: { date: { [Op.gte]: new Date() } }, // score: null
    });
    await Promise.all(
      futureMatches.map(async (match) => {
        return this.scheduleEvents(match);
      }),
    ).catch((ex) => {
      console.log(`[${new Date().toLocaleString('ru-RU')}] [V9ku] Event scedule failed`, ex);
    });
  }

  async scheduleEvents(event) {
    const reminderDates = [
      new Date(event.date.getTime() - 28 * 60 * 60 * 1000),
      new Date(event.date.getTime() - 6 * 60 * 60 * 1000),
      new Date(event.date.getTime() - 3 * 60 * 60 * 1000),
    ];
    // Schedule reminders
    for (let date of reminderDates) {
      if (date > new Date()) {
        scheduler.scheduleJob(date, async () => {
          console.log(
            `[${new Date().toLocaleString('ru-RU')}] [V9ku] Reminder sending for match ${event.id}`,
          );
          const users = await V9kuUser.findAll({ where: { enabled: true } });
          for (let user of users) {
            try {
              const existingMessage = await V9kuMessage.findOne({
                where: { userId: user.userId, matchId: event.id },
              });
              // Если сообщение уже существует и нет голоса, отправляем реплай
              if (existingMessage) {
                const existingVote = await V9kuVote.findOne({
                  where: { userId: user.userId, matchId: event.id },
                });
                if (!existingVote) {
                  this.telegram.sendMessage(
                    user.userId,
                    `Не забудьте сделать прогноз на матч ${event.team1} - ${event.team2}`,
                    { reply_to_message_id: existingMessage.messageId },
                  );
                }
              } else {
                const caption = matchCaptionBuilder(user.name, event);
                const message = await this.telegram.sendMessage(user.userId, caption.text, {
                  reply_markup: {
                    inline_keyboard: [caption.buttons],
                  },
                });
                await V9kuMessage.create({
                  messageId: message.message_id,
                  userId: user.userId,
                  matchId: event.id,
                });
              }
            } catch (ex) {
              console.log(
                `[${new Date().toLocaleString('ru-RU')}] [V9ku] Failed to notify user`,
                ex.message,
              );
            }
          }
        });
      }
    }
    // Schedule photo sending
    const tableDate = new Date(event.date.getTime() - 1 * 60 * 60 * 1000);
    scheduler.scheduleJob(tableDate, async () => {
      console.log(
        `[${new Date().toLocaleString('ru-RU')}] [V9ku] Photo sending for match ${event.id}`,
      );
      const matchPhoto = await V9kuTableRenderer.renderMatch(event);
      const users = await V9kuUser.findAll({ where: { enabled: true } });
      for (let user of users) {
        try {
          await this.telegram.sendPhoto(user.userId, { source: matchPhoto });
        } catch (ex) {
          console.log(
            `[${new Date().toLocaleString('ru-RU')}] [V9ku] Failed to send match table`,
            ex.message,
          );
        }
      }
    });
    console.log(
      `[${new Date().toLocaleString('ru-RU')}] [V9ku] Events scheduled for match ${event.team1} - ${
        event.team2
      } at ${event.date}`,
    );
  }
}

export const v9kuEventScheduler = new EventScheduler();
