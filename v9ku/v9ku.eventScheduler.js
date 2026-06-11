import scheduler from 'node-schedule';
import { V9kuMatch, V9kuUser, Op } from './v9ku.db.js';
import { sendMatchReminders } from './v9ku.service.js';
import { V9kuTableRenderer } from './v9ku.table.js';
import { v9kuConfig } from '../config.js';

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
      new Date(event.date.getTime() - v9kuConfig.calls.first * 60 * 60 * 1000),
      new Date(event.date.getTime() - v9kuConfig.calls.second * 60 * 60 * 1000),
      new Date(event.date.getTime() - v9kuConfig.calls.third * 60 * 60 * 1000),
    ];
    // Schedule reminders
    for (let date of reminderDates) {
      if (date > new Date()) {
        scheduler.scheduleJob(date, async () => {
          console.log(
            `[${new Date().toLocaleString('ru-RU')}] [V9ku] Reminder sending for match ${event.id}`,
          );
          await sendMatchReminders(this.telegram, event);
        });
      }
    }
    // Schedule photo sending
    const tableDate = new Date(event.date.getTime() - v9kuConfig.calls.last * 60 * 60 * 1000);
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
