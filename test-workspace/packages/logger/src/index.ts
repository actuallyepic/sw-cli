import winston from 'winston'
import chalk from 'chalk'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})

export function logInfo(message: string) {
  console.log(chalk.blue(message))
}

export function logError(message: string) {
  console.log(chalk.red(message))
}