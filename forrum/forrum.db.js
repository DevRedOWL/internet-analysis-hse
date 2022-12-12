import { Sequelize, Model, DataTypes, Op } from 'sequelize';
import { db } from '../config.js';
import { ForrumStep } from './forrum.enum.js';

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

async function init(callback) {
  await sequelize.sync({ alter: true });
  return callback();
}

export { Op, sequelize, init, ForrumUser };
