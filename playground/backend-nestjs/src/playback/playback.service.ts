import { Injectable } from '@nestjs/common';
import { RecordingService, RecordingNotFoundError } from '../recording/recording.service';
import { SessionService, SessionNotFoundError } from '../session/session.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PlaybackCaptureService } from './playback-capture.service';
import {
  RecordingData
} from '../common/types/recording.types';
import {
  PlaybackConfig,
  PlaybackStatus
} from '../common/types/playback.types';
import {
  StartPlaybackDto,
  PlaybackControlDto,
  PlaybackSeekDto
} from '../common/dto/playback.dto';

export class PlaybackNotFoundError extends Error {
  constructor(recordingId: string) {
    super(`Reprodução não encontrada: ${recordingId}`);
    this.name = 'PlaybackNotFoundError';
  }
}

export class PlaybackAlreadyActiveError extends Error {
  constructor(public existingRecordingId: string) {
    super(`Reprodução já está em andamento para esta gravação`);
    this.name = 'PlaybackAlreadyActiveError';
  }
}

export class SessionOrRecordingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionOrRecordingNotFoundError';
  }
}

@Injectable()
export class PlaybackService {
  private activePlaybackServices: Map<string, PlaybackCaptureService> = new Map();

  constructor(
    private readonly recordingService: RecordingService,
    private readonly sessionService: SessionService,
    private readonly websocketGateway: WebsocketGateway
  ) {}

  async startPlayback(dto: StartPlaybackDto): Promise<{
    success: boolean;
    message: string;
    recordingId: string;
    sessionId: string;
    config: PlaybackConfig;
    status: PlaybackStatus;
  }> {
    // Validar sessionId
    const session = this.sessionService.getSession(dto.sessionId);
    if (!session) {
      throw new SessionNotFoundError(dto.sessionId);
    }

    // Validar recordingId
    const recording = this.recordingService.getRecording(dto.recordingId);
    if (!recording) {
      throw new RecordingNotFoundError(dto.recordingId);
    }

    // Verificar se já existe reprodução ativa
    if (this.activePlaybackServices.has(dto.recordingId)) {
      throw new PlaybackAlreadyActiveError(dto.recordingId);
    }

    // Build PlaybackConfig
    const config: PlaybackConfig = {
      speed: dto.speed || 1,
      pauseOnError: dto.pauseOnError !== false,
      skipScreenshots: dto.skipScreenshots || false,
      startFromEvent: dto.startFromEvent,
      endAtEvent: dto.endAtEvent
    };

    // Instantiate PlaybackCaptureService
    const captureService = new PlaybackCaptureService(
      session.page,
      recording,
      config,
      this.websocketGateway.broadcast.bind(this.websocketGateway)
    );

    // Store in Map
    this.activePlaybackServices.set(dto.recordingId, captureService);

    try {
      await captureService.startPlayback();
    } catch (error) {
      // Remove from map if start fails
      this.activePlaybackServices.delete(dto.recordingId);
      throw error;
    }

    console.log(`▶️ Reprodução iniciada para gravação: ${dto.recordingId}`);

    return {
      success: true,
      message: 'Reprodução iniciada com sucesso!',
      recordingId: dto.recordingId,
      sessionId: dto.sessionId,
      config,
      status: captureService.getStatus()
    };
  }

  controlPlayback(dto: PlaybackControlDto): {
    success: boolean;
    message: string;
    recordingId: string;
    action: string;
    status: PlaybackStatus;
  } {
    const captureService = this.activePlaybackServices.get(dto.recordingId);
    if (!captureService) {
      throw new PlaybackNotFoundError(dto.recordingId);
    }

    let message: string;

    switch (dto.action) {
      case 'pause':
        captureService.pausePlayback();
        message = 'Reprodução pausada';
        break;
      case 'resume':
        captureService.resumePlayback();
        message = 'Reprodução resumida';
        break;
      case 'stop':
        captureService.stopPlayback();
        this.activePlaybackServices.delete(dto.recordingId);
        message = 'Reprodução parada';
        break;
      default:
        throw new Error(`Ação de reprodução inválida: ${dto.action}`);
    }

    // If speed is provided and action is resume, update speed (not implemented in Express, but available in DTO)
    if (dto.speed && dto.action === 'resume') {
      console.log(`⚠️ Speed change during resume not implemented: ${dto.speed}`);
    }

    return {
      success: true,
      message,
      recordingId: dto.recordingId,
      action: dto.action,
      status: captureService.getStatus()
    };
  }

  async seekPlayback(dto: PlaybackSeekDto): Promise<{
    success: boolean;
    message: string;
    recordingId: string;
    eventIndex: number;
    status: PlaybackStatus;
  }> {
    const captureService = this.activePlaybackServices.get(dto.recordingId);
    if (!captureService) {
      throw new PlaybackNotFoundError(dto.recordingId);
    }

    await captureService.seekToEvent(dto.eventIndex);

    return {
      success: true,
      message: `Navegado para evento ${dto.eventIndex + 1}`,
      recordingId: dto.recordingId,
      eventIndex: dto.eventIndex,
      status: captureService.getStatus()
    };
  }

  getPlaybackStatus(recordingId: string): {
    success: boolean;
    isActive: boolean;
    status: PlaybackStatus | null;
  } {
    const captureService = this.activePlaybackServices.get(recordingId);

    if (!captureService) {
      // Not an error, matching Express behavior
      return {
        success: true,
        isActive: false,
        status: null
      };
    }

    return {
      success: true,
      isActive: captureService.isActive(),
      status: captureService.getStatus()
    };
  }

  /**
   * Helper to get all active playback recording IDs
   */
  getActivePlaybacks(): string[] {
    return Array.from(this.activePlaybackServices.keys());
  }

  /**
   * Helper for shutdown: cleanup specific playback
   */
  cleanupPlayback(recordingId: string): void {
    const captureService = this.activePlaybackServices.get(recordingId);
    if (captureService) {
      captureService.cleanup();
      this.activePlaybackServices.delete(recordingId);
    }
  }
}