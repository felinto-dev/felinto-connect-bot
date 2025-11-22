import { Module } from '@nestjs/common';
import { RecordingService } from './recording.service';
import { RecordingController } from './recording.controller';
import { SessionModule } from '../session/session.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [SessionModule, WebsocketModule],
  providers: [RecordingService],
  controllers: [RecordingController],
  exports: [RecordingService]
})
export class RecordingModule {}