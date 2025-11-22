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
import { RecordingService, RecordingNotFoundError, RecordingAlreadyActiveError } from './recording.service';
import { SessionNotFoundError } from '../session/session.service';
import { StartRecordingDto, StopRecordingDto, PauseRecordingDto } from '../common/dto/recording.dto';

@Controller('api/recording')
export class RecordingController {
  constructor(private readonly recordingService: RecordingService) {}

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

      if (error.message.includes('Não é possível')) {
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
}