import { Module } from '@nestjs/common';
import { UtilsController } from './utils.controller';
import { ChromeDetectorService } from './chrome-detector.service';
import { DocumentationService } from './documentation.service';
import { SessionModule } from '../session/session.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    SessionModule,      // Para injetar SessionService no controller
    WebsocketModule     // Para injetar WebsocketGateway nos services
  ],
  providers: [
    ChromeDetectorService,
    DocumentationService
  ],
  controllers: [
    UtilsController
  ],
  exports: [
    ChromeDetectorService  // Exportar para uso em outros módulos se necessário
  ]
})
export class UtilsModule {}