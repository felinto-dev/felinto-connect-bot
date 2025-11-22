import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UseFilters,
} from '@nestjs/common';
import { SessionService, SessionNotFoundError } from './session.service';
import { CreateSessionDto, ExecuteCodeDto, SessionIdDto, ScreenshotOptionsDto, TakeScreenshotDto } from '../common/dto/session.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Session')
@Controller('api/session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiOperation({ summary: 'Cria nova sessão Puppeteer', description: 'Conecta ao Chrome remoto via WebSocket e inicializa uma nova sessão com página configurada.' })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({ status: 200, description: 'Sessão criada com sucesso', schema: { example: { success: true, sessionId: 'abc123-def456', message: 'Sessão criada com sucesso!', pageInfo: { url: 'about:blank', title: '', timestamp: '2024-01-15T10:30:00.000Z' } } } })
  @ApiResponse({ status: 500, description: 'Erro ao criar sessão (Chrome inacessível, configuração inválida)' })
  @Post('create')
  @HttpCode(HttpStatus.OK)
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    try {
      const sessionData = await this.sessionService.createSession(
        createSessionDto.toSessionConfig()
      );

      return {
        success: true,
        sessionId: sessionData.id,
        message: 'Sessão criada com sucesso!',
        pageInfo: sessionData.pageInfo,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      });
    }
  }

  @ApiOperation({ summary: 'Executa código JavaScript na sessão', description: 'Executa código arbitrário no contexto da página Puppeteer usando Node VM. Timeout de 30s.' })
  @ApiBody({ type: ExecuteCodeDto })
  @ApiResponse({ status: 200, description: 'Código executado com sucesso', schema: { example: { success: true, message: 'Código executado com sucesso!', result: 'https://example.com', executionTime: 123 } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada ou expirada', schema: { example: { error: 'Sessão não encontrada', sessionExpired: true, message: 'A sessão expirou ou foi removida. Crie uma nova sessão.' } } })
  @ApiResponse({ status: 500, description: 'Erro na execução do código (timeout, erro de sintaxe)' })
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeCode(@Body() executeCodeDto: ExecuteCodeDto) {
    try {
      const result = await this.sessionService.executeCode(
        executeCodeDto.sessionId,
        executeCodeDto.code
      );

      return {
        success: true,
        message: 'Código executado com sucesso!',
        ...result,
      };
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        this.sessionService.notifySessionExpired(executeCodeDto.sessionId);
        throw new NotFoundException({
          error: 'Sessão não encontrada',
          sessionExpired: true,
          message: 'A sessão expirou ou foi removida. Crie uma nova sessão.',
        });
      }

      throw new InternalServerErrorException({
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      });
    }
  }

  @ApiOperation({ summary: 'Captura screenshot da sessão', description: 'Tira screenshot da página atual com opções configuráveis (qualidade, fullPage, tipo).' })
  @ApiBody({ type: TakeScreenshotDto })
  @ApiResponse({ status: 200, description: 'Screenshot capturado', schema: { example: { success: true, screenshot: 'data:image/jpeg;base64,/9j/4AAQ...', message: 'Screenshot capturado com sucesso!' } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro ao capturar screenshot' })
  @Post('screenshot')
  @HttpCode(HttpStatus.OK)
  async takeScreenshot(@Body() dto: TakeScreenshotDto) {
    try {
      this.sessionService.notifyScreenshotCapture('starting');

      const screenshot = await this.sessionService.takeScreenshot(dto.sessionId, dto.options);

      this.sessionService.notifyScreenshotCapture('success');

      const imageType = dto.options?.quality ? 'jpeg' : 'png';

      return {
        success: true,
        screenshot: `data:image/${imageType};base64,${screenshot}`,
        message: 'Screenshot capturado com sucesso!',
      };
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        this.sessionService.notifySessionExpired(dto.sessionId);
        throw new NotFoundException({
          error: 'Sessão não encontrada',
          sessionExpired: true,
          message: 'A sessão expirou ou foi removida. Crie uma nova sessão.',
        });
      }

      throw new InternalServerErrorException({
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      });
    }
  }

  @ApiOperation({ summary: 'Remove sessão ativa', description: 'Fecha browser context e remove sessão do gerenciador. Libera recursos.' })
  @ApiParam({ name: 'sessionId', description: 'ID da sessão a remover', example: 'abc123-def456' })
  @ApiResponse({ status: 200, description: 'Sessão removida', schema: { example: { success: true, message: 'Sessão removida com sucesso!' } } })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  async removeSession(@Param('sessionId') sessionId: string) {
    try {
      const removed = await this.sessionService.removeSession(sessionId);

      if (removed) {
        return {
          success: true,
          message: 'Sessão removida com sucesso!',
        };
      } else {
        throw new NotFoundException({
          error: 'Sessão não encontrada',
        });
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException({
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      });
    }
  }

  @ApiOperation({ summary: 'Obtém estatísticas de sessões', description: 'Retorna contadores de sessões ativas, total criado, e tempo médio de vida.' })
  @ApiResponse({ status: 200, description: 'Estatísticas obtidas', schema: { example: { success: true, stats: { activeSessions: 2, totalCreated: 15, averageLifetime: 120000 } } } })
  @Get('s/stats')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    try {
      const stats = await this.sessionService.getStats();

      return {
        success: true,
        stats,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      });
    }
  }

  @ApiOperation({ summary: 'Valida se sessão está ativa', description: 'Verifica se sessão existe, está ativa, e retorna informações da página atual.' })
  @ApiParam({ name: 'sessionId', description: 'ID da sessão a validar', example: 'abc123-def456' })
  @ApiResponse({ status: 200, description: 'Sessão válida', schema: { example: { success: true, valid: true, sessionId: 'abc123-def456', pageInfo: { url: 'https://example.com', title: 'Example', timestamp: '2024-01-15T10:30:00.000Z' } } } })
  @ApiResponse({ status: 404, description: 'Sessão inválida ou expirada', schema: { example: { success: false, valid: false, error: 'Sessão não encontrada ou inválida', sessionExpired: true } } })
  @ApiResponse({ status: 400, description: 'sessionId não fornecido' })
  @Get(':sessionId/validate')
  @HttpCode(HttpStatus.OK)
  async validateSession(@Param('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException({
        success: false,
        valid: false,
        error: 'sessionId é obrigatório',
      });
    }

    try {
      const isValid = await this.sessionService.isSessionValid(sessionId);

      if (isValid) {
        const session = this.sessionService.getSession(sessionId);
        if (!session) {
          throw new NotFoundException({
            success: false,
            valid: false,
            error: 'Sessão não encontrada ou inválida',
            sessionExpired: true,
          });
        }
        const pageInfo = await this.sessionService.getPageInfo(session.page);

        return {
          success: true,
          valid: true,
          sessionId,
          pageInfo,
        };
      } else {
        throw new NotFoundException({
          success: false,
          valid: false,
          error: 'Sessão não encontrada ou inválida',
          sessionExpired: true,
        });
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException({
        success: false,
        valid: false,
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      });
    }
  }
}