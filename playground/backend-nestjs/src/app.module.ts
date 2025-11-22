import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    WebsocketModule,
    SessionModule,
  ],
})
export class AppModule {}