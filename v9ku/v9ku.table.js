import { V9kuMatch, Op, V9kuVote, V9kuUser } from './v9ku.db.js';
import { timeFormatConfig } from './v9ku.service.js';
import TableRenderer, { saveImage } from 'table-renderer';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
const renderTable = TableRenderer.default().render;

export class V9kuTableRenderer {
  static async renderMatch(match) {
    const teamTexts = [
      match.team1.replace(/[^a-zа-я0-9 ]/gi, ''),
      match.team2.replace(/[^a-zа-я0-9 ]/gi, ''),
    ];
    const table = {
      title: `Результаты на ${match.date.getDate()}.${match.date.getMonth()}`,
      columns: [
        { width: 350, title: 'Участник', dataIndex: 'name' },
        {
          title: `${teamTexts[0]} – ${teamTexts[1]}`,
          dataIndex: `${match.id}`,
          width: 5 * `${teamTexts[0]} – ${teamTexts[1]}`.length,
          align: 'center',
        },
      ],
      dataSource: [,],
    };
    const votes = await V9kuVote.findAll({ where: { matchId: match.id } });
    for (let vote of votes) {
      const user = await V9kuUser.findOne({ where: { userId: vote.userId } });
      table.dataSource.push({ [match.id]: `${vote.team1} – ${vote.team2}`, name: user.name });
      console.log(vote);
    }
    const dir = './results/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const result = path.join(dir, `match_${match.id}.png`);
    saveImage(
      renderTable(table),
      result, //
    );
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
      title: `Результаты на ${start.getDate()}.${start.getMonth()}`,
      columns: [{ width: 350, title: 'Участник', dataIndex: 'name' }],
      dataSource: [
        //'-',
        //{ name: 'Dima Tomchuk', 1: '2 - 5', 0: '5 - 0' },
        //{ name: 'Daniel Varentsov', 1: '5 - 2', 0: '2 - 2' },
      ],
    };
    for (let match of matchesForDay) {
      const teamTexts = [
        match.team1.replace(/[^a-zа-я0-9 ]/gi, ''),
        match.team2.replace(/[^a-zа-я0-9 ]/gi, ''),
      ];
      table.columns.push({
        title: `${teamTexts[0]} – ${teamTexts[1]}`,
        dataIndex: `${match.id}`,
        width: 11 * `${teamTexts[0]} – ${teamTexts[1]}`.length,
        align: 'center',
      });
      const votes = await V9kuVote.findAll({ where: { matchId: match.id } });
      for (let vote of votes) {
        console.log(vote);
      }
    }
    const dir = './results/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    saveImage(
      renderTable(table),
      path.join(dir, `summary_${start.toLocaleDateString('ru-RU')}.png`),
    );

    console.log(
      start.toLocaleString('ru-RU', timeFormatConfig),
      end.toLocaleString('ru-RU', timeFormatConfig),
    );
  }
}
