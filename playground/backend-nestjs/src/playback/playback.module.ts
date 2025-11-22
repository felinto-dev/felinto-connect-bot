import { Module } from '@nestjs/common';
import { PlaybackService } from './playback.service';
import { PlaybackController } from './playback.controller';
import { RecordingModule } from '../recording/recording.module';
import { SessionModule } from '../session/session.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [RecordingModule, SessionModule, WebsocketModule],
  providers: [PlaybackService],
  controllers: [PlaybackController],
  exports: [PlaybackService]
})
export class PlaybackModule {}