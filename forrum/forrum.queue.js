import { Queue, Worker } from 'bullmq';
import { redis } from '../config.js';
import { ForrumUser } from './forrum.db.js';
import { ForrumStep, ForrumQueueJobName } from './forrum.enum.js';

export class ForrumQueue {
  telegram;
  queueName = 'forrum_queue';
  queue;

  constructor(telegram) {
    this.telegram = telegram;
    this.queue = new Queue(this.queueName, {
      connection: redis,
    });
  }

  initWorkers() {
    const worker = new Worker(
      this.queueName,
      async (job) => {
        console.log('Executing scheduled job', job.data.userId);
        switch (job.name) {
          case ForrumQueueJobName.NOTIFICATION:
            await this.notificationProcessor(job);
            break;
          default:
            throw new Exception('Unknown job processed');
        }
      },
      {
        connection: redis,
        limiter: {
          max: 10,
          duration: 1000,
        },
      },
    );

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} has been completed!`);
    });

    worker.on('failed', (job, err) => {
      console.warn(`Failed to complete ${job.id} ${err.message}`);
    });
  }

  async notificationProcessor(job) {
    const { userId, customMessage, stepToNotify } = job.data;
    const user = await ForrumUser.findOne({ where: { userId } });
    if (user.step === stepToNotify) {
      await this.telegram.sendMessage(user.userId, customMessage || 'ТЕКСТ_НАПОМИНАНИЯ');
    }
  }

  async notifyUser(userId, stepToNotify, delay = 86400000, customMessage = null) {
    this.queue.add('notification', { userId, stepToNotify, customMessage }, { delay });
  }
}
