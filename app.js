import { resolve } from 'path';
import pkg from './package.json' assert { type: 'json' };
import { existsSync } from 'fs';
import express from 'express';

const app = express();

app.get('/healthcheck', (req, res) => {
  return res.sendStatus(200);
});

app.get('/version', (req, res) => {
  return res.send(pkg.version);
});

app.get('/matchRating/:matchId([0-9]+)', async (req, res) => {
  const { matchId } = req.params;
  if (!matchId) {
    return res.sendStatus(400);
  }
  return await res.sendFile(resolve(`./results/match_${matchId}.png`));
});

export { app };
