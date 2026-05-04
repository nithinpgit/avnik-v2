import 'dotenv/config'

export const config = {
  httpPort: Number(process.env.PORT) || 3001,
  /** Must match meet-backend MEDIA_JWT_SECRET */
  mediaJwtSecret: process.env.MEDIA_JWT_SECRET ?? 'dev-media-jwt-change-in-production',
  rtcMinPort: Number(process.env.MEDIASOUP_RTC_MIN_PORT) || 40_000,
  rtcMaxPort: Number(process.env.MEDIASOUP_RTC_MAX_PORT) || 40_100,
  /** ICE host candidate announced to browsers (set in K8s to node/LB public IP or Pod host) */
  announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP?.trim() || undefined,
  logLevel: process.env.LOG_LEVEL ?? 'info',
}
