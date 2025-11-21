import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './config/config.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurações globais
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  // Get the native ConfigService and set it up in our AppConfigService
  const nativeConfigService = app.get(ConfigService);
  const appConfigService = app.get(AppConfigService);
  appConfigService.setConfigService(nativeConfigService);

  const port = appConfigService.getPort();
  await app.listen(port);

  console.log(`🚀 NestJS Backend rodando em http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
}

bootstrap();