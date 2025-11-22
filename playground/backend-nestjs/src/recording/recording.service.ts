import { Injectable, OnModuleDestroy, OnApplicationShutdown } from '@nestjs/common';
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

export class InvalidRecordingStatusError extends Error {
  constructor(status: string, action: string) {
    super(`Não é possível ${action} uma gravação com status: ${status}`);
    this.name = 'InvalidRecordingStatusError';
  }
}

@Injectable()
export class RecordingService implements OnModuleDestroy, OnApplicationShutdown {
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
    const session = this.sessionService.getSession(sessionId);

    // Verificar se já existe gravação ativa para sessão
    const existingRecording = Array.from(this.activeRecordings.values())
      .find(rec => rec.sessionId === sessionId && rec.status === 'recording');

    if (existingRecording) {
      throw new RecordingAlreadyActiveError(existingRecording.id);
    }

    // Gerar recordingId
    const recordingId = uuidv4();

    // Obter metadados da página (compatível com backend Express)
    const pageUrl = await session.page.url();
    const viewport = await session.page.viewport();
    const userAgent = await session.page.evaluate(() => navigator.userAgent);

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
        initialUrl: pageUrl,
        userAgent: userAgent,
        viewport: viewport ? { width: viewport.width, height: viewport.height } : undefined
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
        data: { status: 'paused', pausedAt, recordingId }
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
        data: { status: 'recording', resumedAt, recordingId }
      });

      console.log(`▶️ Gravação resumida: ${recordingId}`);

    } else {
      throw new InvalidRecordingStatusError(recording.status, recording.status === 'stopped' ? 'pausar/resumir' : 'pausar');
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
    // Buscar gravação ativa para sessão (apenas com status 'recording' ou 'paused')
    const recording = Array.from(this.activeRecordings.values())
      .find(rec => rec.sessionId === sessionId && (rec.status === 'recording' || rec.status === 'paused'));

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

    // Obter dados mais recentes do serviço de captura (RecordingCaptureService é a fonte de verdade)
    const updatedRecording = this.activeRecordingServices.get(recording.id)?.getRecordingData() || recording;

    // Opcionalmente atualizar o map com dados mais recentes
    this.activeRecordings.set(recording.id, updatedRecording);

    // Calcular estatísticas atuais
    const currentTime = Date.now();
    const duration = updatedRecording.status === 'recording'
      ? currentTime - updatedRecording.startTime
      : (updatedRecording.duration || 0);

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

    return {
      recordingId: updatedRecording.id,
      status: updatedRecording.status,
      stats,
      currentEvent: updatedRecording.events[updatedRecording.events.length - 1],
      isActive: updatedRecording.status === 'recording' || updatedRecording.status === 'paused'
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

  async onModuleDestroy() {
    await this.cleanup();
  }

  async onApplicationShutdown(signal?: string) {
    await this.cleanup();
  }

  private async cleanup() {
    if (this.activeRecordingServices.size === 0) {
      return;
    }

    console.log(`🎬 Parando ${this.activeRecordingServices.size} gravações ativas...`);

    for (const [recordingId, captureService] of this.activeRecordingServices.entries()) {
      try {
        await captureService.stopCapture();
        console.log(`✅ Gravação ${recordingId} finalizada`);
      } catch (error) {
        console.error(`❌ Erro ao parar gravação ${recordingId}:`, error);
      }
    }

    this.activeRecordingServices.clear();
    this.activeRecordings.clear();
    console.log('✅ Gravações finalizadas');
  }
}