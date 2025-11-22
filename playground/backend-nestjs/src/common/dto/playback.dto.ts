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

export enum PlaybackAction {
  PLAY = 'play',
  PAUSE = 'pause',
  RESUME = 'resume',
  STOP = 'stop',
}

export class StartPlaybackDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsString()
  @IsNotEmpty()
  sessionId: string;

  /**
   * Speed multiplier for playback (0.1 to 5.0)
   * Default: 1.0 (normal speed)
   * This field is required with a default value to ensure predictable behavior
   */
  @IsNumber()
  @Min(0.1)
  @Max(5)
  speed: number = 1;

  /**
   * Whether to pause playback when an error occurs
   * Default: true
   * This field is required with a default value to ensure predictable behavior
   */
  @IsBoolean()
  pauseOnError: boolean = true;

  /**
   * Whether to skip screenshots during playback
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @IsBoolean()
  skipScreenshots: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startFromEvent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  endAtEvent?: number;
}

export class PlaybackControlDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsEnum(PlaybackAction)
  action: PlaybackAction;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  speed?: number;
}

export class PlaybackSeekDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsNumber()
  @Min(0)
  eventIndex: number;
}