import {
  IsString,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PlaybackAction {
  PLAY = 'play',
  PAUSE = 'pause',
  RESUME = 'resume',
  STOP = 'stop',
}

export class StartPlaybackDto {
  @ApiProperty({ description: 'ID da gravação a ser reproduzida', example: 'rec-abc123' })
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @ApiProperty({ description: 'ID da sessão onde a reprodução ocorrerá', example: 'abc123-def456' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  /**
   * Speed multiplier for playback (0.1 to 5.0)
   * Default: 1.0 (normal speed)
   * This field is required with a default value to ensure predictable behavior
   */
  @ApiProperty({ description: 'Multiplicador de velocidade (0.1 = 10% velocidade, 2.0 = 2x velocidade)', minimum: 0.1, maximum: 5, default: 1, example: 1 })
  @IsNumber()
  @Min(0.1)
  @Max(5)
  speed: number = 1;

  /**
   * Whether to pause playback when an error occurs
   * Default: true
   * This field is required with a default value to ensure predictable behavior
   */
  @ApiProperty({ description: 'Pausa reprodução automaticamente ao encontrar erro', default: true })
  @IsBoolean()
  pauseOnError: boolean = true;

  /**
   * Whether to skip screenshots during playback
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @ApiProperty({ description: 'Ignora screenshots durante reprodução para maior velocidade', default: false })
  @IsBoolean()
  skipScreenshots: boolean = false;

  @ApiPropertyOptional({ description: 'Índice do evento inicial (0-based)', minimum: 0, example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startFromEvent?: number;

  @ApiPropertyOptional({ description: 'Índice do evento final (0-based)', minimum: 0, example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  endAtEvent?: number;
}

export class PlaybackControlDto {
  @ApiProperty({ description: 'ID da reprodução a controlar', example: 'rec-abc123' })
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @ApiProperty({ description: 'Ação de controle', enum: PlaybackAction, example: 'pause' })
  @IsEnum(PlaybackAction)
  action: PlaybackAction;

  @ApiPropertyOptional({ description: 'Nova velocidade (apenas para action=resume)', minimum: 0.1, maximum: 5, example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  speed?: number;
}

export class PlaybackSeekDto {
  @ApiProperty({ description: 'ID da reprodução', example: 'rec-abc123' })
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @ApiProperty({ description: 'Índice do evento para pular (0-based)', minimum: 0, example: 50 })
  @IsNumber()
  @Min(0)
  eventIndex: number;
}