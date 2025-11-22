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
import { PlaybackService, PlaybackNotFoundError, PlaybackAlreadyActiveError } from './playback.service';
import { SessionService, SessionNotFoundError } from '../session/session.service';
import { RecordingService, RecordingNotFoundError } from '../recording/recording.service';
import { StartPlaybackDto, PlaybackControlDto, PlaybackSeekDto } from '../common/dto/playback.dto';
import {
  StartPlaybackResponse,
  PlaybackControlResponse,
  PlaybackSeekResponse,
  PlaybackStatusResponse
} from '../common/types/api-responses.types';

@Controller('api')
export class PlaybackController {
  constructor(
    private readonly playbackService: PlaybackService
  ) {}

  @Post('recording/playback/start')
  @HttpCode(HttpStatus.OK)
  async startPlayback(@Body() dto: StartPlaybackDto): Promise<StartPlaybackResponse> {
    try {
      return await this.playbackService.startPlayback(dto);
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Sessão não encontrada',
          sessionExpired: true
        });
      }

      if (error instanceof RecordingNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Gravação não encontrada'
        });
      }

      if (error instanceof PlaybackAlreadyActiveError) {
        throw new ConflictException({
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

  @Post('recording/playback/control')
  @HttpCode(HttpStatus.OK)
  async controlPlayback(@Body() dto: PlaybackControlDto): Promise<PlaybackControlResponse> {
    try {
      return this.playbackService.controlPlayback(dto);
    } catch (error) {
      if (error instanceof PlaybackNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Reprodução não encontrada'
        });
      }

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @Post('recording/playback/seek')
  @HttpCode(HttpStatus.OK)
  async seekPlayback(@Body() dto: PlaybackSeekDto): Promise<PlaybackSeekResponse> {
    try {
      return await this.playbackService.seekPlayback(dto);
    } catch (error) {
      if (error instanceof PlaybackNotFoundError) {
        throw new NotFoundException({
          success: false,
          error: 'Reprodução não encontrada'
        });
      }

      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }

  @Get('recording/playback/status/:recordingId')
  @HttpCode(HttpStatus.OK)
  async getPlaybackStatus(@Param('recordingId') recordingId: string): Promise<PlaybackStatusResponse> {
    if (!recordingId || recordingId.trim() === '') {
      throw new BadRequestException({
        success: false,
        error: 'recordingId é obrigatório'
      });
    }

    try {
      return this.playbackService.getPlaybackStatus(recordingId);
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }
}