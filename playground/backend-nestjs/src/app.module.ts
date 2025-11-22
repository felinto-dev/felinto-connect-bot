import { Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SessionModule } from './session/session.module';
import { RecordingModule } from './recording/recording.module';
import { PlaybackModule } from './playback/playback.module';
import { UtilsModule } from './utils/utils.module';
import { WebsocketGateway } from './websocket/websocket.gateway';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    WebsocketModule,
    SessionModule,
    RecordingModule,
    PlaybackModule,
    UtilsModule,
  ],
})
export class AppModule implements OnModuleDestroy {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  async onModuleDestroy() {
    try {
      console.log('\n🛑 Iniciando shutdown gracioso do NestJS backend...');

      // Explicitly close WebSocket connections
      this.websocketGateway.closeAllConnections();

      // Note: Other services (RecordingService, PlaybackService, SessionService)
      // will have their onModuleDestroy methods called automatically by NestJS
      // in reverse order of their initialization

      console.log('🎯 Shutdown gracioso concluído');
    } catch (error) {
      console.error('❌ Erro durante shutdown:', error);
    }
  }
}