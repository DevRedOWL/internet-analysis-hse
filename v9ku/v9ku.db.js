import { Sequelize, Model, DataTypes, Op, Transaction } from 'sequelize';
import { db } from '../config.js';

const { dialect, user, password, host, port, database } = db;
const sequelize = new Sequelize(`${dialect}://${user}:${password}@${host}:${port}/${database}`, {
  logging: false,
  query: { raw: true },
});

class V9kuUser extends Model {}
V9kuUser.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userId: DataTypes.BIGINT,
    score: {
      type: DataTypes.DECIMAL,
      defaultValue: 0,
    },
    perfect: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    name: DataTypes.STRING,
    phone: DataTypes.STRING,
    lastRequest: {
      type: DataTypes.DATE,
      defaultValue: new Date(Date.now() - 5 * 60000),
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { sequelize, modelName: 'v9ku_user' },
);

class V9kuMatch extends Model {}
V9kuMatch.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    team1: DataTypes.STRING,
    team2: DataTypes.STRING,
    score: DataTypes.ARRAY(DataTypes.INTEGER),
    coef: {
      type: DataTypes.FLOAT,
      defaultValue: 1.0,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    url: DataTypes.STRING,
  },
  { sequelize, modelName: 'v9ku_match' },
);

class V9kuMessage extends Model {}
V9kuMessage.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userId: DataTypes.BIGINT,
    messageId: DataTypes.INTEGER,
    matchId: DataTypes.INTEGER,
  },
  { sequelize, modelName: 'v9ku_message' },
);
V9kuMessage.hasOne(V9kuMatch, {
  foreignKey: {
    name: 'matchId',
  },
});

class V9kuVote extends Model {}
V9kuVote.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    matchId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userId: {
      allowNull: false,
      type: DataTypes.BIGINT,
    },
    team1: DataTypes.INTEGER,
    team2: DataTypes.INTEGER,
  },
  { sequelize, modelName: 'v9ku_vote' },
);

async function initDB(callback) {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS postgress_sessions(id varchar PRIMARY KEY, session varchar);',
  );
  await sequelize.query(
    `ALTER TABLE v9ku_votes DROP CONSTRAINT IF EXISTS match_user_unique; 
    ALTER TABLE v9ku_votes ADD CONSTRAINT match_user_unique UNIQUE ("matchId", "userId")`,
  );
  await sequelize.query(
    `ALTER TABLE v9ku_matches DROP CONSTRAINT IF EXISTS teams_time_unique; 
    ALTER TABLE v9ku_matches ADD CONSTRAINT teams_time_unique UNIQUE ("team1", "team2", "date")`,
  );
  // try {
  //   await V9kuMatch.create({
  //     id: 0,
  //     team1: '🇦🇷 Агрентина',
  //     team2: '🇯🇲 Ямайка',
  //     date: new Date(1998, 6, 21, 18 - 3, 50),
  //     url: 'https://www.championat.com/football/article-4583417-argentina-yamajka-5-0-kak-slozhilis-sudby-geroev-pesni-gruppy-chajf-i-uchastnikov-matcha-chempionata-mira-1998-goda.html',
  //   });
  // } catch (ex) {}
  return callback();
}

export { Op, sequelize, initDB, V9kuUser, V9kuMatch, V9kuMessage, V9kuVote };
