require("dotenv").config();
const db = require("./db");
const telegramApp = require("./telegramClient");

telegramApp.launch();
console.log("Bot started, enjoy ma friends");
