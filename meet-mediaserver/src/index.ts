import { startServer } from './server.js'
import { logger } from './logger.js'

void startServer().catch((e) => {
  logger.fatal(e)
  process.exit(1)
})
