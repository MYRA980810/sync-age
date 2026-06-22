import winston from 'winston';
import { join } from 'path';
import { app } from 'electron';

const logPath = app?.getPath('userData') || '.';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: join(logPath, 'sync-agent-error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    }),
    new winston.transports.File({
      filename: join(logPath, 'sync-agent.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});
