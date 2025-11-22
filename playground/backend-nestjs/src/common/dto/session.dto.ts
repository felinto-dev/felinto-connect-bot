import { IsString, IsBoolean, IsOptional, IsNotEmpty, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  browserWSEndpoint: string;

  @IsOptional()
  @IsBoolean()
  $debug?: boolean;
}

export class ExecuteCodeDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class SessionIdDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}