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

  @IsNumber()
  @Min(0.1)
  @Max(5)
  speed: number = 1;

  @IsBoolean()
  pauseOnError: boolean = true;

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