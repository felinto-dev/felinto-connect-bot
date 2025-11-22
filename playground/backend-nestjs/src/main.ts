import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurações globais - espelhando configuração do Express backend
  app.enableCors();
  app.setGlobalPrefix('api');

  // Configuração JSON e URLencoded para espelhar backend Express
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  await app.listen(port);

  console.log(`🚀 NestJS Backend rodando em http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
}

bootstrap();