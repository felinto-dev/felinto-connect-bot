import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  HttpException
} from '@nestjs/common';
import { RecordingService, RecordingNotFoundError, RecordingAlreadyActiveError, InvalidRecordingStatusError } from './recording.service';
import { ExportService } from './export.service';
import { SessionService, SessionNotFoundError } from '../session/session.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { StartRecordingDto, StopRecordingDto, PauseRecordingDto, ScreenshotDto } from '../common/dto/recording.dto';
import { ExportRecordingDto } from '../common/dto/export.dto';
import {
  ScreenshotResponse,
  PreviewResponse,
  PageInfoResponse,
  ExportRecordingResponse,
  RecordingListResponse,
  RecordingDetailResponse
} from '../common/types/api-responses.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Recording', 'Export')
@Controller('')
export class RecordingController {
  constructor(
    private readonly recordingService: RecordingService,
    private readonly exportService: ExportService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly sessionService: SessionService
  ) {}

  /**
   * Helper method para validar sessão ativa
   * @param sessionId ID da sessão a ser validada
   * @returns Sessão validada e ativa
   * @throws BadRequestException se sessionId for inválido
   * @throws NotFoundException se sessão não for encontrada ou não estiver ativa
   */
  private async getActiveSessionOrThrow(sessionId: string) {
    if (!sessionId || sessionId.trim() === '') {
      throw new BadRequestException({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    let session;
    try {
      session = await this.sessionService.getSession(sessionId);
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Sessão não encontrada',
          sessionExpired: true
        });
      }
      throw error;
    }

    const isValid = await this.sessionService.isSessionValid(sessionId);
    if (!isValid) {
      throw new NotFoundException({
        success: false,
        error: 'Sessão foi fechada ou não está mais ativa',
        sessionExpired: true
      });
    }

    return session;
  }

  @ApiOperation({ summary: 'Inicia gravação de eventos', description: 'Começa a capturar eventos do usuário (clicks, digitação, navegação) na sessão especificada.', tags: ['Recording'] })
  @ApiBody({ type: StartRecordingDto })
  @ApiResponse({ status: 200, description: 'Gravação iniciada', schema: { example: { success: true, recordingId: 'rec-abc123', sessionId: 'abc123-def456', message: 'Gravação iniciada', config: { events: ['click', 'type'], mode: 'manual', delay: 100, captureScreenshots: true } } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 409, description: 'Gravação já ativa nesta sessão', schema: { example: { success: false, error: 'Já existe uma gravação ativa para esta sessão', recordingId: 'rec-existing' } } })
  @Post('recording/start')
  @HttpCode(HttpStatus.OK)
  async startRecording(@Body() dto: StartRecordingDto) {
    try {
      const result = await this.recordingService.startRecording(
        dto.sessionId,
        dto.toRecordingConfig()
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Sessão não encontrada',
          sessionExpired: true
        });
      }

      if (error instanceof RecordingAlreadyActiveError) {
        throw new ConflictException({
          success: false,
          error: error.message,
          recordingId: error.existingRecordingId
        });
      }

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Para gravação ativa', description: 'Finaliza gravação e retorna estatísticas completas (eventos, duração, tipos).', tags: ['Recording'] })
  @ApiBody({ type: StopRecordingDto })
  @ApiResponse({ status: 200, description: 'Gravação parada', schema: { example: { success: true, recordingId: 'rec-abc123', message: 'Gravação parada', stats: { totalEvents: 45, duration: 120000, eventTypes: { click: 20, type: 15, navigation: 10 } }, recording: { id: 'rec-abc123', sessionId: 'abc123', events: [], status: 'stopped' } } } })
  @ApiResponse({ status: 404, description: 'Gravação não encontrada' })
  @Post('recording/stop')
  @HttpCode(HttpStatus.OK)
  async stopRecording(@Body() dto: StopRecordingDto) {
    try {
      const result = await this.recordingService.stopRecording(dto.recordingId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      if (error instanceof RecordingNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Gravação não encontrada'
        });
      }

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Pausa/retoma gravação', description: 'Alterna estado de pausa da gravação. Eventos não são capturados enquanto pausado.', tags: ['Recording'] })
  @ApiBody({ type: PauseRecordingDto })
  @ApiResponse({ status: 200, description: 'Estado alterado', schema: { example: { success: true, recordingId: 'rec-abc123', message: 'Gravação pausada', status: 'paused', pausedAt: 1705315800000 } } })
  @ApiResponse({ status: 404, description: 'Gravação não encontrada' })
  @ApiResponse({ status: 400, description: 'Status inválido para operação' })
  @Post('recording/pause')
  @HttpCode(HttpStatus.OK)
  async pauseRecording(@Body() dto: PauseRecordingDto) {
    try {
      const result = await this.recordingService.pauseRecording(dto.recordingId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      if (error instanceof RecordingNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Gravação não encontrada'
        });
      }

      if (error instanceof InvalidRecordingStatusError) {
        throw new BadRequestException({
          success: false,
          error: error.message
        });
      }

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Obtém status da gravação', description: 'Retorna estado atual, estatísticas e último evento capturado.', tags: ['Recording'] })
  @ApiParam({ name: 'sessionId', description: 'ID da sessão', example: 'abc123-def456' })
  @ApiResponse({ status: 200, description: 'Status obtido', schema: { example: { success: true, recordingId: 'rec-abc123', status: 'recording', stats: { totalEvents: 30, duration: 60000 }, isActive: true } } })
  @ApiResponse({ status: 400, description: 'sessionId não fornecido' })
  @Get('recording/status/:sessionId')
  @HttpCode(HttpStatus.OK)
  async getRecordingStatus(@Param('sessionId') sessionId: string) {
    if (!sessionId || sessionId.trim() === '') {
      throw new BadRequestException({
        success: false,
        error: 'Session ID é obrigatório'
      });
    }

    try {
      const result = await this.recordingService.getRecordingStatus(sessionId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Captura screenshot com metadados', description: 'Tira screenshot JPEG da sessão com qualidade configurável e retorna metadados completos.', tags: ['Recording'] })
  @ApiParam({ name: 'sessionId', description: 'ID da sessão', example: 'abc123-def456' })
  @ApiBody({ type: ScreenshotDto })
  @ApiResponse({ status: 200, description: 'Screenshot capturado', schema: { example: { success: true, screenshot: 'data:image/jpeg;base64,...', metadata: { url: 'https://example.com', title: 'Example', viewport: { width: 1920, height: 1080 }, timestamp: 1705315800000, quality: 80, fullPage: false, size: 245 } } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada ou expirada' })
  @Post('recording/screenshot/:sessionId')
  @HttpCode(HttpStatus.OK)
  async captureScreenshot(
    @Param('sessionId') sessionId: string,
    @Body() dto: ScreenshotDto
  ): Promise<ScreenshotResponse> {
    const session = await this.getActiveSessionOrThrow(sessionId);
    try {

      console.log(`📸 Capturando screenshot da sessão: ${sessionId}`);

      const requestedQuality = dto.quality || 80;
      const effectiveQuality = Math.min(Math.max(requestedQuality, 10), 100);
      const screenshot = await session.page.screenshot({
        type: 'jpeg',
        encoding: 'base64',
        fullPage: dto.fullPage || false,
        quality: effectiveQuality
      });

      const pageUrl = await session.page.url();
      const pageTitle = await session.page.title();
      const viewport = await session.page.viewport();

      const size = Math.round((screenshot.length * 3) / 4 / 1024);

      const response: ScreenshotResponse = {
        success: true,
        screenshot: `data:image/jpeg;base64,${screenshot}`,
        metadata: {
          url: pageUrl,
          title: pageTitle,
          viewport,
          timestamp: Date.now(),
          quality: requestedQuality,
          fullPage: dto.fullPage || false,
          size
        }
      };

      console.log(`✅ Screenshot capturado: ${size}KB`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Captura preview rápido', description: 'Screenshot otimizado (quality=60, viewport only) para previews em tempo real.', tags: ['Recording'] })
  @ApiParam({ name: 'sessionId', description: 'ID da sessão', example: 'abc123-def456' })
  @ApiResponse({ status: 200, description: 'Preview capturado', schema: { example: { success: true, preview: 'data:image/jpeg;base64,...', metadata: { url: 'https://example.com', title: 'Example', timestamp: 1705315800000, isPreview: true } } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @Get('recording/preview/:sessionId')
  @HttpCode(HttpStatus.OK)
  async capturePreview(@Param('sessionId') sessionId: string): Promise<PreviewResponse> {
    const session = await this.getActiveSessionOrThrow(sessionId);
    try {

      const screenshot = await session.page.screenshot({
        type: 'jpeg',
        encoding: 'base64',
        fullPage: false,
        quality: 60
      });

      const pageUrl = await session.page.url();
      const pageTitle = await session.page.title();

      return {
        success: true,
        preview: `data:image/jpeg;base64,${screenshot}`,
        metadata: {
          url: pageUrl,
          title: pageTitle,
          timestamp: Date.now(),
          isPreview: true
        }
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Obtém informações da página', description: 'Retorna URL, título, viewport e métricas de performance da página atual.', tags: ['Recording'] })
  @ApiParam({ name: 'sessionId', description: 'ID da sessão', example: 'abc123-def456' })
  @ApiResponse({ status: 200, description: 'Informações obtidas', schema: { example: { success: true, pageInfo: { url: 'https://example.com', title: 'Example', viewport: { width: 1920, height: 1080 }, timestamp: 1705315800000, metrics: { Timestamp: 123.456, Documents: 1, Frames: 1, JSHeapUsedSize: 5000000 } } } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 400, description: 'sessionId não fornecido' })
  @Get('recording/page-info/:sessionId')
  @HttpCode(HttpStatus.OK)
  async getPageInfo(@Param('sessionId') sessionId: string): Promise<PageInfoResponse> {
    if (!sessionId || sessionId.trim() === '') {
      throw new BadRequestException({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    try {
      let session;
      try {
        session = await this.sessionService.getSession(sessionId);
      } catch (error) {
        if (error instanceof SessionNotFoundError) {
          throw new NotFoundException({
            success: false,
            error: 'Sessão não encontrada',
            sessionExpired: true
          });
        }
        throw error;
      }

      const pageUrl = await session.page.url();
      const pageTitle = await session.page.title();
      const viewport = await session.page.viewport();

      let metrics = null;
      try {
        metrics = await session.page.metrics();
      } catch (error) {
        // Métricas podem não estar disponíveis em alguns cenários, não é crítico
        console.warn(`⚠️ Não foi possível obter métricas da página para sessão ${sessionId}:`, error instanceof Error ? error.message : error);
        metrics = null;
      }

      return {
        success: true,
        pageInfo: {
          url: pageUrl,
          title: pageTitle,
          viewport,
          timestamp: Date.now(),
          metrics: metrics ? metrics as Record<string, number> : null
        }
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Exporta gravação', description: 'Converte gravação para formato especificado (JSON ou Puppeteer script). Suporta minificação e comentários.', tags: ['Export'] })
  @ApiBody({ type: ExportRecordingDto })
  @ApiResponse({ status: 200, description: 'Exportação concluída', schema: { example: { success: true, format: 'json', content: '{"events":[...]}', filename: 'recording-rec-abc123.json', size: 12345, metadata: { exportedAt: 1705315800000, originalRecordingId: 'rec-abc123', eventCount: 45 } } } })
  @ApiResponse({ status: 404, description: 'Gravação não encontrada' })
  @ApiResponse({ status: 400, description: 'Opções inválidas (recordingId ou format ausente)' })
  @Post('recording/export')
  @HttpCode(HttpStatus.OK)
  async exportRecording(@Body() dto: ExportRecordingDto): Promise<ExportRecordingResponse> {
    // Extrair recordingId e options no formato Express
    const { recordingId, options } = dto.toExportRequest();

    try {

      // Validação explícita para compatibilidade com backend Express
      if (!recordingId || recordingId.trim() === '') {
        throw new BadRequestException({
          success: false,
          error: 'recordingId é obrigatório'
        });
      }

      if (!options || !options.format) {
        throw new BadRequestException({
          success: false,
          error: 'options.format é obrigatório'
        });
      }

      // Buscar gravação
      const recording = this.recordingService.getRecording(recordingId);
      if (!recording) {
        throw new NotFoundException({
          success: false,
          error: 'Gravação não encontrada'
        });
      }

      // Validar opções
      try {
        this.exportService.validateExportOptions(options);
      } catch (validationError) {
        throw new BadRequestException({
          success: false,
          error: `Opções inválidas: ${validationError instanceof Error ? validationError.message : 'Erro desconhecido'}`
        });
      }

      console.log(`📤 Iniciando exportação: ${recordingId} -> ${options.format}`);

      // Nota: Mantendo paridade com backend Express - apenas eventos de sucesso/erro
      // O processo de exportação é rápido (formatação de dados) e não tem etapas intermediárias
      // que justifiquem eventos de progresso detalhados.

      // Realizar exportação
      const exportResult = await this.exportService.exportRecording(
        recording,
        options
      );

      // Broadcast de sucesso
      this.websocketGateway.broadcast({
        type: 'success',
        message: `📤 Exportação concluída: ${exportResult.filename}`,
        sessionId: recording.sessionId,
        recordingId: recording.id,
        data: {
          format: exportResult.format,
          size: exportResult.size,
          filename: exportResult.filename
        }
      });

      return {
        success: true,
        ...exportResult
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('❌ Erro ao exportar gravação:', error instanceof Error ? error.message : error);

      // Broadcast de erro
      this.websocketGateway.broadcast({
        type: 'error',
        message: `❌ Erro na exportação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        sessionId: undefined,
        recordingId: recordingId,
        data: {
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      });

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Lista todas as gravações', description: 'Retorna resumo de todas as gravações ativas (id, sessionId, duração, contagem de eventos).', tags: ['Export'] })
  @ApiResponse({ status: 200, description: 'Lista obtida', schema: { example: { success: true, recordings: [{ id: 'rec-abc123', sessionId: 'abc123', createdAt: 1705315800000, duration: 120000, eventCount: 45, status: 'stopped', metadata: { initialUrl: 'https://example.com', totalEvents: 45 } }], total: 1 } } })
  @Get('recordings')
  @HttpCode(HttpStatus.OK)
  async listRecordings(): Promise<RecordingListResponse> {
    try {
      const recordings = this.recordingService.getActiveRecordings();

      const recordingSummaries = recordings.map(recording => ({
        id: recording.id,
        sessionId: recording.sessionId,
        createdAt: recording.startTime,
        duration: recording.duration,
        eventCount: recording.events.length,
        status: recording.status,
        metadata: {
          initialUrl: recording.metadata.initialUrl,
          totalEvents: recording.metadata.totalEvents ?? recording.events.length
        }
      }));

      return {
        success: true,
        recordings: recordingSummaries,
        total: recordings.length
      };
    } catch (error) {
      console.error('❌ Erro ao listar gravações:', error instanceof Error ? error.message : error);

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @ApiOperation({ summary: 'Obtém gravação completa', description: 'Retorna todos os dados da gravação incluindo array completo de eventos.', tags: ['Export'] })
  @ApiParam({ name: 'recordingId', description: 'ID da gravação', example: 'rec-abc123' })
  @ApiResponse({ status: 200, description: 'Gravação obtida', schema: { example: { success: true, recording: { id: 'rec-abc123', sessionId: 'abc123', events: [], status: 'stopped', startTime: 1705315800000, duration: 120000 } } } })
  @ApiResponse({ status: 404, description: 'Gravação não encontrada' })
  @Get('recording/:recordingId')
  @HttpCode(HttpStatus.OK)
  async getRecordingById(@Param('recordingId') recordingId: string): Promise<RecordingDetailResponse> {
    try {
      const recording = this.recordingService.getRecording(recordingId);

      if (!recording) {
        throw new NotFoundException({
          success: false,
          error: 'Gravação não encontrada'
        });
      }

      return {
        success: true,
        recording
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('❌ Erro ao obter gravação:', error instanceof Error ? error.message : error);

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }
}