import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WsAdapter } from '@nestjs/platform-ws';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

function setupGracefulShutdown(app: INestApplication) {
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

  // Configuração Swagger
  const config = new DocumentBuilder()
    .setTitle('Felinto Connect Bot - Backend API')
    .setDescription('API REST para gerenciamento de sessões Puppeteer, gravação de eventos, reprodução e exportação. Backend NestJS migrado do Express com funcionalidades completas de automação web.')
    .setVersion('1.0.0')
    .addTag('Health', 'Endpoints de verificação de saúde da aplicação')
    .addTag('Session', 'Gerenciamento de sessões Puppeteer (criar, executar código, screenshots, validar)')
    .addTag('Recording', 'Gravação de eventos do usuário (clicks, digitação, navegação, formulários)')
    .addTag('Playback', 'Reprodução de gravações com controle de velocidade e estado')
    .addTag('Export', 'Exportação de gravações em formatos JSON e Puppeteer')
    .addTag('Utils', 'Utilitários (detecção Chrome, documentação, endpoint legacy)')
    .addServer('http://localhost:3002', 'Servidor de Desenvolvimento')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Felinto Connect Bot API',
    customCss: '.swagger-ui .topbar { display: none }'
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  await app.listen(port);

  console.log(`🚀 NestJS Backend rodando em http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`🔌 WebSocket disponível em ws://localhost:${port}/ws`);
  console.log(`📚 Documentação Swagger: http://localhost:${port}/api/docs`);
  console.log('\n🔧 Shutdown gracioso habilitado (Ctrl+C para parar)');

  // Setup graceful shutdown handlers
  setupGracefulShutdown(app);
}

bootstrap();