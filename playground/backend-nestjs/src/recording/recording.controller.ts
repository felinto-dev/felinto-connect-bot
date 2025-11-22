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

@Controller('api')
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