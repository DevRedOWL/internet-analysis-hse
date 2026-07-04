import { V9kuMatch, Op, V9kuVote, V9kuUser } from './v9ku.db.js';
import { formatVoteScore, hasCompletedVote, timeFormatConfig } from './v9ku.service.js';
import { saveImage } from 'table-renderer';
import { createCanvas } from 'canvas';
import { renderTable, measureColumnTitleWidth } from './v9ku.tableCanvas.js';
import path from 'path';
import fs from 'fs';

const measureCtx = createCanvas(1, 1).getContext('2d');
measureCtx.font = 'normal 16px "Noto Sans", Helvetica, Arial, sans-serif';

export class V9kuTableRenderer {
  static async renderMatch(match) {
    const matchTitle = `${match.team1} – ${match.team2}`;
    const matchColumnWidth = await measureColumnTitleWidth(measureCtx, matchTitle, 120);
    const table = {
      title: `Результаты на ${match.date.getDate()}.${match.date.getMonth() + 1}`,
      columns: [
        { width: 350, title: 'Участник', dataIndex: 'name' },
        {
          title: matchTitle,
          dataIndex: `${match.id}`,
          width: matchColumnWidth,
          align: 'center',
        },
      ],
      dataSource: [],
    };
    const votes = await V9kuVote.findAll({ where: { matchId: match.id } });
    for (let vote of votes) {
      if (!hasCompletedVote(vote)) {
        continue;
      }
      const user = await V9kuUser.findOne({ where: { userId: vote.userId } });
      if (!user) {
        continue;
      }
      table.dataSource.push({ [match.id]: formatVoteScore(vote), name: user.name });
    }
    const dir = './results/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const result = path.join(dir, `match_${match.id}.png`);
    await saveImage(await renderTable(table), result);
    return result;
  }

  static async renderDay(date) {
    const start = new Date(date.getTime());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    const matchesForDay = await V9kuMatch.findAll({
      where: {
        date: {
          [Op.gte]: start,
          [Op.lte]: end,
        },
      },
      order: [['date', 'ASC']],
    });

    const table = {
      title: `Результаты на ${start.getDate()}.${start.getMonth() + 1}`,
      columns: [{ width: 350, title: 'Участник', dataIndex: 'name' }],
      dataSource: [
        //'-',
        //{ name: 'Dima Tomchuk', 1: '2 - 5', 0: '5 - 0' },
        //{ name: 'Daniel Varentsov', 1: '5 - 2', 0: '2 - 2' },
      ],
    };
    for (let match of matchesForDay) {
      const matchTitle = `${match.team1} – ${match.team2}`;
      const matchColumnWidth = await measureColumnTitleWidth(measureCtx, matchTitle, 120);
      table.columns.push({
        title: matchTitle,
        dataIndex: `${match.id}`,
        width: matchColumnWidth,
        align: 'center',
      });
      const votes = await V9kuVote.findAll({ where: { matchId: match.id } });
      for (let vote of votes) {
        // FIXME: Sending
        console.log(vote);
      }
    }
    const dir = './results/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await saveImage(
      await renderTable(table),
      path.join(dir, `summary_${start.toLocaleDateString('ru-RU')}.png`),
    );

    console.log(
      start.toLocaleString('ru-RU', timeFormatConfig),
      end.toLocaleString('ru-RU', timeFormatConfig),
    );
  }
}
