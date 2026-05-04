import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { httpRequestContextMiddleware } from './common/middleware/http-request-context.middleware'
import { HealthModule } from './health/health.module'
import { MediaModule } from './media/media.module'
import { RoomsModule } from './rooms/rooms.module'

@Module({
  imports: [HealthModule, MediaModule, RoomsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(httpRequestContextMiddleware).forRoutes('*')
  }
}
