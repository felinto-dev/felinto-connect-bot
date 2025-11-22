import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SessionModule } from './session/session.module';
import { RecordingModule } from './recording/recording.module';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    WebsocketModule,
    SessionModule,
    RecordingModule,
  ],
})
export class AppModule {}