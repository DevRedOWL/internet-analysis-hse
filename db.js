const { Sequelize, Model, DataTypes, Op } = require("sequelize");
const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT } = process.env;
const sequelize = new Sequelize(
  `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST || "localhost"}:${
    DB_PORT || "5432"
  }/${DB_NAME}`,
  { logging: false }
);

class TinkoffUser extends Model {}
TinkoffUser.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userId: DataTypes.INTEGER,
    currency: DataTypes.STRING,
    bounds: {
      type: DataTypes.JSONB,
      defaultValue: null,
    },
    lastRequest: {
      type: DataTypes.DATE,
      defaultValue: new Date(Date.now() - 5 * 60000),
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { sequelize, modelName: "tinkoff_user" }
);

(async () => {
  await sequelize.sync({ alter: true });
})();

module.exports = {
  Op,
  sequelize,
  TinkoffUser,
};
