import { Injectable } from '@nestjs/common';
import { SessionService, SessionNotFoundError } from '../session/session.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { RecordingCaptureService } from './recording-capture.service';
import {
  RecordingData,
  RecordingConfig,
  RecordingStatus,
  RecordingStats,
  RecordingEvent
} from '../common/types/recording.types';
import { v4 as uuidv4 } from 'uuid';

export class RecordingNotFoundError extends Error {
  constructor(recordingId: string) {
    super(`Gravação não encontrada: ${recordingId}`);
    this.name = 'RecordingNotFoundError';
  }
}

export class RecordingAlreadyActiveError extends Error {
  constructor(public existingRecordingId: string) {
    super(`Já existe uma gravação ativa para esta sessão`);
    this.name = 'RecordingAlreadyActiveError';
  }
}

@Injectable()
export class RecordingService {
  private activeRecordings: Map<string, RecordingData> = new Map();
  private activeRecordingServices: Map<string, RecordingCaptureService> = new Map();

  constructor(
    private readonly sessionService: SessionService,
    private readonly websocketGateway: WebsocketGateway
  ) {}

  async startRecording(sessionId: string, config: RecordingConfig): Promise<{
    recordingId: string;
    sessionId: string;
    message: string;
    config: RecordingConfig;
  }> {
    // Validar sessão
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Verificar se já existe gravação ativa para sessão
    const existingRecording = Array.from(this.activeRecordings.values())
      .find(rec => rec.sessionId === sessionId && rec.status === 'recording');

    if (existingRecording) {
      throw new RecordingAlreadyActiveError(existingRecording.id);
    }

    // Gerar recordingId
    const recordingId = uuidv4();

    // Obter metadados da página
    const pageInfo = await session.page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }));

    // Criar RecordingData
    const recordingData: RecordingData = {
      id: recordingId,
      sessionId,
      config,
      events: [],
      status: 'recording' as RecordingStatus,
      startTime: Date.now(),
      metadata: {
        totalEvents: 0,
        totalScreenshots: 0,
        pageTitle: pageInfo.title,
        startUrl: pageInfo.url,
        userAgent: session.page.browser().version() || 'Unknown',
        viewport: pageInfo.viewport,
        duration: 0
      }
    };

    // Armazenar gravação
    this.activeRecordings.set(recordingId, recordingData);

    // Criar instância do RecordingCaptureService
    const captureService = new RecordingCaptureService(
      session.page,
      recordingData,
      this.websocketGateway.broadcast.bind(this.websocketGateway)
    );

    // Armazenar serviço de captura
    this.activeRecordingServices.set(recordingId, captureService);

    // Iniciar captura
    await captureService.startCapture();

    console.log(`🔴 Gravação iniciada: ${recordingId} para sessão: ${sessionId}`);

    return {
      recordingId,
      sessionId,
      message: 'Gravação iniciada com sucesso',
      config
    };
  }

  async stopRecording(recordingId: string): Promise<{
    recordingId: string;
    message: string;
    stats: RecordingStats;
    recording: RecordingData;
  }> {
    // Buscar gravação e serviço
    const recording = this.activeRecordings.get(recordingId);
    const captureService = this.activeRecordingServices.get(recordingId);

    if (!recording || !captureService) {
      throw new RecordingNotFoundError(recordingId);
    }

    // Parar captura
    await captureService.stopCapture();

    // Obter dados atualizados
    const updatedRecording = captureService.getRecordingData();

    // Atualizar metadados finais
    const endTime = Date.now();
    const duration = endTime - updatedRecording.startTime;

    updatedRecording.status = 'stopped';
    updatedRecording.endTime = endTime;
    updatedRecording.duration = duration;
    updatedRecording.metadata.totalEvents = updatedRecording.events.length;
    updatedRecording.metadata.duration = duration;

    // Armazenar dados atualizados
    this.activeRecordings.set(recordingId, updatedRecording);

    // Remover serviço ativo
    this.activeRecordingServices.delete(recordingId);

    // Calcular estatísticas
    const stats: RecordingStats = {
      totalEvents: updatedRecording.events.length,
      eventsByType: updatedRecording.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      duration,
      averageEventInterval: updatedRecording.events.length > 1
        ? duration / (updatedRecording.events.length - 1)
        : 0,
      screenshotCount: updatedRecording.metadata.totalScreenshots
    };

    console.log(`⏹️ Gravação finalizada: ${recordingId} - ${stats.totalEvents} eventos`);

    return {
      recordingId,
      message: 'Gravação finalizada com sucesso',
      stats,
      recording: updatedRecording
    };
  }

  async pauseRecording(recordingId: string): Promise<{
    recordingId: string;
    message: string;
    status: RecordingStatus;
    pausedAt?: number;
    resumedAt?: number;
  }> {
    // Buscar gravação e serviço
    const recording = this.activeRecordings.get(recordingId);
    const captureService = this.activeRecordingServices.get(recordingId);

    if (!recording || !captureService) {
      throw new RecordingNotFoundError(recordingId);
    }

    let newStatus: RecordingStatus;
    let message: string;
    let pausedAt: number | undefined;
    let resumedAt: number | undefined;

    if (recording.status === 'recording') {
      // Pausar
      captureService.pauseCapture();
      newStatus = 'paused';
      pausedAt = Date.now();
      message = 'Gravação pausada';

      this.websocketGateway.broadcast({
        type: 'recording_status',
        message: `⏸️ Gravação pausada: ${recordingId}`,
        sessionId: recording.sessionId,
        recordingId,
        data: { status: 'paused', pausedAt }
      });

      console.log(`⏸️ Gravação pausada: ${recordingId}`);

    } else if (recording.status === 'paused') {
      // Resumir
      captureService.resumeCapture();
      newStatus = 'recording';
      resumedAt = Date.now();
      message = 'Gravação resumida';

      this.websocketGateway.broadcast({
        type: 'recording_status',
        message: `▶️ Gravação resumida: ${recordingId}`,
        sessionId: recording.sessionId,
        recordingId,
        data: { status: 'recording', resumedAt }
      });

      console.log(`▶️ Gravação resumida: ${recordingId}`);

    } else {
      throw new Error(`Não é possível ${recording.status === 'stopped' ? 'pausar/resumir' : 'pausar'} uma gravação com status: ${recording.status}`);
    }

    // Atualizar status
    recording.status = newStatus;
    if (pausedAt) {
      recording.pausedAt = pausedAt;
    }
    if (resumedAt) {
      recording.resumedAt = resumedAt;
    }

    // Armazenar alteração
    this.activeRecordings.set(recordingId, recording);

    return {
      recordingId,
      message,
      status: newStatus,
      pausedAt,
      resumedAt
    };
  }

  async getRecordingStatus(sessionId: string): Promise<{
    recordingId: string | null;
    status: RecordingStatus;
    stats: RecordingStats;
    currentEvent?: RecordingEvent;
    isActive: boolean;
  }> {
    // Buscar gravação ativa para sessão
    const recording = Array.from(this.activeRecordings.values())
      .find(rec => rec.sessionId === sessionId);

    if (!recording) {
      return {
        recordingId: null,
        status: 'idle',
        stats: {
          totalEvents: 0,
          eventsByType: {},
          duration: 0,
          averageEventInterval: 0,
          screenshotCount: 0
        },
        isActive: false
      };
    }

    // Calcular estatísticas atuais
    const currentTime = Date.now();
    const duration = recording.status === 'recording'
      ? currentTime - recording.startTime
      : (recording.duration || 0);

    const stats: RecordingStats = {
      totalEvents: recording.events.length,
      eventsByType: recording.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      duration,
      averageEventInterval: recording.events.length > 1
        ? duration / (recording.events.length - 1)
        : 0,
      screenshotCount: recording.metadata.totalScreenshots
    };

    return {
      recordingId: recording.id,
      status: recording.status,
      stats,
      currentEvent: recording.events[recording.events.length - 1],
      isActive: recording.status === 'recording' || recording.status === 'paused'
    };
  }

  /**
   * Obter gravação por ID (usado por outros serviços)
   */
  getRecording(recordingId: string): RecordingData | undefined {
    return this.activeRecordings.get(recordingId);
  }

  /**
   * Listar todas as gravações ativas
   */
  getActiveRecordings(): RecordingData[] {
    return Array.from(this.activeRecordings.values());
  }

  /**
   * Verificar se existe gravação ativa para sessão
   */
  hasActiveRecording(sessionId: string): boolean {
    return Array.from(this.activeRecordings.values())
      .some(rec => rec.sessionId === sessionId && rec.status === 'recording');
  }
}