import * as mediasoup from 'mediasoup'
import type { RtpCodecCapability, Worker } from 'mediasoup/types'
import { config } from './config.js'
import { logger } from './logger.js'

let worker: Worker | undefined

export async function getWorker(): Promise<Worker> {
  if (worker) return worker
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: config.rtcMinPort,
    rtcMaxPort: config.rtcMaxPort,
  })
  worker.on('died', () => {
    logger.fatal('mediasoup worker died — exiting')
    process.exit(1)
  })
  logger.info(
    { rtcMinPort: config.rtcMinPort, rtcMaxPort: config.rtcMaxPort },
    'mediasoup worker created',
  )
  return worker
}

export const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    preferredPayloadType: 111,
    clockRate: 48_000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    preferredPayloadType: 96,
    clockRate: 90_000,
  },
]
