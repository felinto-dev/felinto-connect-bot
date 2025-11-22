import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WsAdapter } from '@nestjs/platform-ws';
import { INestApplication } from '@nestjs/common';

function setupGracefulShutdown(app: INestApplication) {
  const setupSignalHandler = (signal: string, exitCode: number = 0) => {
    const handler = async () => {
      console.log(`\n🛑 Recebido sinal ${signal}. Iniciando shutdown gracioso...`);
      try {
        await app.close();
        console.log('🎯 Shutdown gracioso concluído');
        process.exit(exitCode);
      } catch (error) {
        console.error('❌ Erro durante shutdown:', error);
        process.exit(1);
      }
    };
    process.on(signal, handler);
  };

  // Handle SIGINT and SIGTERM
  setupSignalHandler('SIGINT', 0);
  setupSignalHandler('SIGTERM', 0);

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    try {
      await app.close();
    } catch (closeError) {
      console.error('Erro ao fechar aplicação:', closeError);
    }
    process.exit(1);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    try {
      await app.close();
    } catch (closeError) {
      console.error('Erro ao fechar aplicação:', closeError);
    }
    process.exit(1);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar WebSocket Adapter
  app.useWebSocketAdapter(new WsAdapter(app));

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
  console.log(`🔌 WebSocket disponível em ws://localhost:${port}/ws`);
  console.log('\n🔧 Shutdown gracioso habilitado (Ctrl+C para parar)');

  // Setup graceful shutdown handlers
  setupGracefulShutdown(app);
}

bootstrap();