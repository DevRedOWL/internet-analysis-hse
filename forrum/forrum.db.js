import { Sequelize, Model, DataTypes, Op } from 'sequelize';
import { db } from '../config.js';
import { ForrumStep, ForrumProfileStatus } from './forrum.enum.js';

const { dialect, user, password, host, port, database } = db;
const sequelize = new Sequelize(`${dialect}://${user}:${password}@${host}:${port}/${database}`, {
  logging: false,
  query: { raw: true },
});

class ForrumUser extends Model {}
ForrumUser.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    phone: DataTypes.STRING,
    step: { type: DataTypes.STRING, defaultValue: ForrumStep.GREETING },
    status: DataTypes.STRING,
    lastRequest: {
      type: DataTypes.DATE,
      defaultValue: new Date(Date.now() - 5 * 60000),
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { sequelize, modelName: 'forrum_user' },
);

class ForrumProfile extends Model {}
ForrumProfile.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userId: DataTypes.INTEGER,
    text: DataTypes.STRING,
    photo: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      defaultValue: ForrumProfileStatus.IN_PROGRESS,
    },
  },
  { sequelize, modelName: 'forrum_profile' },
);

async function initDB(callback) {
  await sequelize.sync({ alter: true });
  return callback();
}

export { Op, sequelize, initDB, ForrumUser, ForrumProfile };
