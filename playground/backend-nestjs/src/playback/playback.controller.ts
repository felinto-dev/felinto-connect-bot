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
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Playback')
@Controller('')
export class PlaybackController {
  constructor(
    private readonly playbackService: PlaybackService
  ) {}

  @ApiOperation({ summary: 'Inicia reprodução de gravação', description: 'Executa eventos gravados na sessão especificada com controle de velocidade. Suporta range de eventos e skip de screenshots.' })
  @ApiBody({ type: StartPlaybackDto })
  @ApiResponse({ status: 200, description: 'Reprodução iniciada', schema: { example: { success: true, message: 'Reprodução iniciada', recordingId: 'rec-abc123', sessionId: 'abc123-def456', config: { speed: 1, pauseOnError: true, skipScreenshots: false }, status: { state: 'playing', currentEventIndex: 0, totalEvents: 45, progress: 0, speed: 1 } } } })
  @ApiResponse({ status: 404, description: 'Sessão ou gravação não encontrada', schema: { example: { success: false, error: 'Sessão não encontrada', sessionExpired: true } } })
  @ApiResponse({ status: 409, description: 'Reprodução já ativa para esta gravação' })
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

  @ApiOperation({ summary: 'Controla reprodução ativa', description: 'Pausa, retoma, para ou ajusta velocidade da reprodução em andamento.' })
  @ApiBody({ type: PlaybackControlDto })
  @ApiResponse({ status: 200, description: 'Controle aplicado', schema: { example: { success: true, message: 'Reprodução pausada', recordingId: 'rec-abc123', action: 'pause', status: { state: 'paused', currentEventIndex: 15, totalEvents: 45, progress: 33.33, speed: 1 } } } })
  @ApiResponse({ status: 404, description: 'Reprodução não encontrada' })
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

  @ApiOperation({ summary: 'Pula para evento específico', description: 'Navega diretamente para índice de evento na reprodução (seek). Útil para debug ou replay parcial.' })
  @ApiBody({ type: PlaybackSeekDto })
  @ApiResponse({ status: 200, description: 'Seek realizado', schema: { example: { success: true, message: 'Seek realizado para evento 25', recordingId: 'rec-abc123', eventIndex: 25, status: { state: 'paused', currentEventIndex: 25, totalEvents: 45, progress: 55.56, speed: 1 } } } })
  @ApiResponse({ status: 404, description: 'Reprodução não encontrada' })
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

  @ApiOperation({ summary: 'Obtém status da reprodução', description: 'Retorna estado atual, progresso, velocidade e índice do evento sendo executado.' })
  @ApiParam({ name: 'recordingId', description: 'ID da gravação', example: 'rec-abc123' })
  @ApiResponse({ status: 200, description: 'Status obtido', schema: { example: { success: true, isActive: true, status: { state: 'playing', currentEventIndex: 20, totalEvents: 45, progress: 44.44, speed: 1.5, errors: [] } } } })
  @ApiResponse({ status: 400, description: 'recordingId não fornecido' })
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