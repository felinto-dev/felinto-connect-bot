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
  InternalServerErrorException
} from '@nestjs/common';
import { RecordingService, RecordingNotFoundError, RecordingAlreadyActiveError, InvalidRecordingStatusError } from './recording.service';
import { SessionService, SessionNotFoundError } from '../session/session.service';
import { StartRecordingDto, StopRecordingDto, PauseRecordingDto, ScreenshotDto } from '../common/dto/recording.dto';
import { ScreenshotResponse, PreviewResponse, PageInfoResponse } from '../common/types/api-responses.types';

@Controller('api/recording')
export class RecordingController {
  constructor(
    private readonly recordingService: RecordingService,
    private readonly sessionService: SessionService
  ) {}

  @Post('start')
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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  @Post('stop')
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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  @Post('pause')
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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  @Get('status/:sessionId')
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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  @Post('screenshot/:sessionId')
  @HttpCode(HttpStatus.OK)
  async captureScreenshot(
    @Param('sessionId') sessionId: string,
    @Body() dto: ScreenshotDto
  ): Promise<ScreenshotResponse> {
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

      const isValid = await this.sessionService.isSessionValid(sessionId);
      if (!isValid) {
        throw new NotFoundException({
          success: false,
          error: 'Sessão foi fechada ou não está mais ativa',
          sessionExpired: true
        });
      }

      console.log(`📸 Capturando screenshot da sessão: ${sessionId}`);

      const quality = Math.min(Math.max(dto.quality || 80, 10), 100);
      const screenshot = await session.page.screenshot({
        type: 'jpeg',
        encoding: 'base64',
        fullPage: dto.fullPage || false,
        quality
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
          quality,
          fullPage: dto.fullPage || false,
          size
        }
      };

      console.log(`✅ Screenshot capturado: ${size}KB`);
      return response;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  @Get('preview/:sessionId')
  @HttpCode(HttpStatus.OK)
  async capturePreview(@Param('sessionId') sessionId: string): Promise<PreviewResponse> {
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

      const isValid = await this.sessionService.isSessionValid(sessionId);
      if (!isValid) {
        throw new NotFoundException({
          success: false,
          error: 'Sessão foi fechada ou não está mais ativa',
          sessionExpired: true
        });
      }

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
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  @Get('page-info/:sessionId')
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
        // Ignore metrics error, set to null
        metrics = null;
      }

      return {
        success: true,
        pageInfo: {
          url: pageUrl,
          title: pageTitle,
          viewport,
          timestamp: Date.now(),
          metrics
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}