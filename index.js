require("dotenv").config();
const db = require("./db");
const telegramApp = require("./telegramClient");

telegramApp.launch();
console.log(`${new Date()} Bot started, enjoy ma friends`);
