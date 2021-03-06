const { Sequelize, Model, DataTypes, Op } = require("sequelize");
const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT } = process.env;
const sequelize = new Sequelize(
  `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST || "localhost"}:${
    DB_PORT || "5432"
  }/${DB_NAME}`,
  { logging: false }
);

class SantaUser extends Model {}
SantaUser.init(
  {
    id: {
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    userid: DataTypes.INTEGER,
    phone: DataTypes.STRING,
    partner: {
      type: DataTypes.INTEGER,
      defaultValue: -1,
    },
  },
  { sequelize, modelName: "santa_user" }
);

(async () => {
  await sequelize.sync({ alter: true });
})();

module.exports = {
  Op,
  sequelize,
  SantaUser,
};
