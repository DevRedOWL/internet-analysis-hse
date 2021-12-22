require("dotenv").config();
const db = require("./db");
const httpApp = require("./apiClient");
const telegramApp = require("./telegramClient");

telegramApp.launch();
httpApp.listen(3000);
console.log(`\x1b[44m App is listening on port: \x1b[1m${3000} \x1b[0m`);
