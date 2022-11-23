import { config } from 'dotenv';
config();

export const admins = {
  list: [236413395, 146023566], // Я, Дима
  error_message: 'У вас недостаточно прав для совершения данного действия',
};

export const db = {
  dialect: 'postgres',
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST | 'localhost',
  port: process.env.DB_PORT | '5432',
};

export const credentials = {
  v9ku_token: process.env.TELEGRAM_API_KEY_V9KU,
  forrum_token: process.env.TELEGRAM_API_KEY_FORRUM,
  forrum_admin_token: process.env.TELEGRAM_API_KEY_FORRUM,
};
