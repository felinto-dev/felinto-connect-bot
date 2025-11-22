import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  Req
} from '@nestjs/common';
import { Request } from 'express';
import { ChromeDetectorService } from './chrome-detector.service';
import { SessionService } from '../session/session.service';
import { DocumentationService } from './documentation.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { SessionConfig } from '../common/types/session.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiExcludeEndpoint } from '@nestjs/swagger';

// DTO para o endpoint legacy /execute
class LegacyExecuteDto {
  [key: string]: any;
}

@ApiTags('Utils')
@Controller()
export class UtilsController {
  private readonly logger = new Logger(UtilsController.name);

  constructor(
    private readonly chromeDetectorService: ChromeDetectorService,
    private readonly sessionService: SessionService,
    private readonly documentationService: DocumentationService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * POST /execute - Endpoint legacy para compatibilidade com frontend antigo
   * Replica lógica do Express backend (linhas 258-354)
   */
  @ApiOperation({ summary: '[LEGACY] Cria sessão sem retornar sessionId', description: 'Endpoint de compatibilidade com frontend antigo. Detecta Chrome automaticamente e cria sessão, mas retorna apenas pageInfo (sem sessionId). Use POST /api/session/create para novos projetos.' })
  @ApiBody({ schema: { type: 'object', properties: { browserWSEndpoint: { type: 'string', example: 'ws://localhost:9222', description: 'Opcional - será sobrescrito por detecção automática' }, $debug: { type: 'boolean', example: true } }, description: 'Configuração parcial - browserWSEndpoint será detectado automaticamente' } })
  @ApiResponse({ status: 200, description: 'Sessão criada (sem sessionId)', schema: { example: { success: true, message: 'Sessão iniciada com sucesso!', pageInfo: { url: 'about:blank', title: '', timestamp: '2024-01-15T10:30:00.000Z' } } } })
  @ApiResponse({ status: 500, description: 'Chrome não detectado ou erro na conexão' })
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeLegacy(@Body() config: LegacyExecuteDto) {
    try {
      // Detectar endpoint Chrome
      const chromeDetection = await this.chromeDetectorService.detectChromeEndpoint();

      if (!chromeDetection.success) {
        throw new HttpException(
          'Chrome não detectado. Execute o comando de inicialização do Chrome no host.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Mesclar config recebido com endpoint detectado e debug
      const mergedConfig: SessionConfig = {
        ...config,
        browserWSEndpoint: `ws://${chromeDetection.endpoint}`,
        $debug: true
      };

      // Criar sessão
      const sessionData = await this.sessionService.createSession(mergedConfig);

      // Retornar apenas pageInfo (sem sessionId para compatibilidade)
      return {
        success: true,
        message: 'Sessão iniciada com sucesso!',
        pageInfo: sessionData.pageInfo
      };

    } catch (error: any) {
      this.logger.error('Erro no endpoint legacy /execute:', error);

      // Tratamento de erros específicos
      if (error.message.includes('Failed to connect to browser') ||
          error.message.includes('ECONNREFUSED')) {
        await this.websocketGateway.broadcast({
          type: 'error',
          message: '❌ Falha ao conectar ao Chrome. Execute no terminal do host (macOS):'
        });

        await this.websocketGateway.broadcast({
          type: 'info',
          message: '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --disable-web-security --disable-features=VizDisplayCompositor'
        });
      }

      if (error.message.includes('Unexpected server response: 404')) {
        await this.websocketGateway.broadcast({
          type: 'warning',
          message: '⚠️ Resposta 404 do Chrome. Certifique-se de usar a flag --remote-debugging-address=0.0.0.0'
        });
      }

      // Lançar exceção com stack trace em modo development
      throw new HttpException({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /chrome/check - Verifica disponibilidade do Chrome
   * Replica lógica do Express backend (linhas 169-252)
   */
  @ApiOperation({ summary: 'Detecta Chrome remoto disponível', description: 'Testa endpoints conhecidos (docker.for.mac.localhost, host.docker.internal, gateway IP) e retorna instruções específicas por plataforma se não encontrado.' })
  @ApiResponse({ status: 200, description: 'Chrome detectado', schema: { example: { available: true, endpoint: 'ws://docker.for.mac.localhost:9222', chromeVersion: 'Chrome/120.0.6099.109', detectedAt: 'docker.for.mac.localhost:9222' } } })
  @ApiResponse({ status: 200, description: 'Chrome não detectado (ainda retorna 200)', schema: { example: { available: false, error: 'Timeout ao conectar', testedEndpoints: ['docker.for.mac.localhost:9222', 'host.docker.internal:9222'], instructions: 'Execute no terminal do host (macOS): /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 ...', troubleshooting: ['1. ESSENCIAL: Use --remote-debugging-address=0.0.0.0', '2. Certifique-se de que o Chrome está rodando no macOS (host)', '...'] } } })
  @Get('chrome/check')
  async checkChrome(@Req() req: Request) {
    try {
      await this.websocketGateway.broadcast({
        type: 'info',
        message: 'Verificando conexão com Chrome...'
      });

      const chromeDetection = await this.chromeDetectorService.detectChromeEndpoint();

      if (chromeDetection.success) {
        return {
          available: true,
          endpoint: `ws://${chromeDetection.endpoint}`,
          chromeVersion: chromeDetection.chromeInfo?.Browser || 'Desconhecido',
          detectedAt: chromeDetection.endpoint
        };
      }

      // Chrome não detectado - montar instruções por plataforma

      // Detectar plataforma
      const isMac = process.platform === 'darwin' ||
                   req.headers['user-agent']?.includes('Mac');

      let instructions: string;
      let troubleshooting: string[];

      if (isMac) {
        instructions = 'Execute no terminal do host (macOS): /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --disable-web-security --disable-features=VizDisplayCompositor';
        troubleshooting = [
          '1. ESSENCIAL: Use --remote-debugging-address=0.0.0.0 para permitir conexões do container',
          '2. Certifique-se de que o Chrome está rodando no macOS (host)',
          '3. Verifique permissões: Ajustes > Privacidade e Segurança > Rede Local',
          '4. Desative firewall temporariamente para testar',
          '5. Tente reiniciar o Docker Desktop se necessário'
        ];
      } else {
        instructions = 'Execute no terminal do host: google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --disable-web-security';
        troubleshooting = [
          '1. ESSENCIAL: Use --remote-debugging-address=0.0.0.0 para permitir conexões do container',
          '2. Execute o comando de inicialização do Chrome no host',
          '3. Verifique se a porta 9222 não está em uso',
          '4. Tente com --disable-web-security se necessário'
        ];
      }

      return {
        available: false,
        error: chromeDetection.lastError,
        testedEndpoints: chromeDetection.testedEndpoints,
        instructions,
        troubleshooting
      };

    } catch (error: any) {
      this.logger.error('Erro no endpoint /chrome/check:', error);

      throw new HttpException({
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /docs - Serve documentação README.md como HTML
   * Replica lógica do Express backend (linhas 148-166)
   */
  @ApiExcludeEndpoint()
  @Get('docs')
  async getDocs() {
    try {
      const docResult = await this.documentationService.getDocumentation();

      if ('error' in docResult) {
        throw new HttpException({
          error: docResult.error,
          details: docResult.details
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        content: docResult.content,
        markdown: docResult.markdown,
        lastModified: docResult.lastModified
      };

    } catch (error: any) {
      this.logger.error('Erro no endpoint /docs:', error);

      // Se já for HttpException, repassar
      if (error.getStatus) {
        throw error;
      }

      throw new HttpException({
        error: 'Não foi possível carregar a documentação',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}