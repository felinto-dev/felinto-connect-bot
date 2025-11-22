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
@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Criar nova sessão',
    description: 'Cria uma nova sessão de navegação usando o endpoint WebSocket do navegador'
  })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({
    status: 200,
    description: 'Sessão criada com sucesso',
    schema: {
      example: {
        success: true,
        sessionId: 'session-12345',
        message: 'Sessão criada com sucesso!',
        pageInfo: {
          title: 'Example Page',
          url: 'https://example.com'
        }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor',
    schema: {
      example: {
        error: 'Failed to connect to browser',
        stack: 'Error stack trace...'
      }
    }
  })
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

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Executar código JavaScript',
    description: 'Executa código JavaScript na página da sessão especificada'
  })
  @ApiBody({ type: ExecuteCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Código executado com sucesso',
    schema: {
      example: {
        success: true,
        message: 'Código executado com sucesso!',
        result: 'Example Page Title',
        error: null
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Sessão não encontrada',
    schema: {
      example: {
        error: 'Sessão não encontrada',
        sessionExpired: true,
        message: 'A sessão expirou ou foi removida. Crie uma nova sessão.'
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor'
  })
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

  @Post('screenshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Capturar screenshot',
    description: 'Captura uma screenshot da página atual da sessão'
  })
  @ApiBody({ type: TakeScreenshotDto })
  @ApiResponse({
    status: 200,
    description: 'Screenshot capturada com sucesso',
    schema: {
      example: {
        success: true,
        screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        message: 'Screenshot capturado com sucesso!'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Sessão não encontrada',
    schema: {
      example: {
        error: 'Sessão não encontrada',
        sessionExpired: true,
        message: 'A sessão expirou ou foi removida. Crie uma nova sessão.'
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor'
  })
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

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remover sessão',
    description: 'Remove uma sessão existente e libera os recursos associados'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID da sessão a ser removida',
    example: 'session-12345'
  })
  @ApiResponse({
    status: 200,
    description: 'Sessão removida com sucesso',
    schema: {
      example: {
        success: true,
        message: 'Sessão removida com sucesso!'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Sessão não encontrada',
    schema: {
      example: {
        error: 'Sessão não encontrada'
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor'
  })
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

  @Get('s/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter estatísticas',
    description: 'Retorna estatísticas das sessões ativas e informações gerais do sistema'
  })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas obtidas com sucesso',
    schema: {
      example: {
        success: true,
        stats: {
          activeSessions: 3,
          totalSessionsCreated: 10,
          uptime: '2h 15m',
          memoryUsage: '45MB'
        }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor'
  })
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

  @Get(':sessionId/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar sessão',
    description: 'Verifica se uma sessão existe e está válida, retornando informações da página atual'
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID da sessão a ser validada',
    example: 'session-12345'
  })
  @ApiResponse({
    status: 200,
    description: 'Sessão válida',
    schema: {
      example: {
        success: true,
        valid: true,
        sessionId: 'session-12345',
        pageInfo: {
          title: 'Example Page',
          url: 'https://example.com'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
    schema: {
      example: {
        success: false,
        valid: false,
        error: 'sessionId é obrigatório'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Sessão não encontrada ou inválida',
    schema: {
      example: {
        success: false,
        valid: false,
        error: 'Sessão não encontrada ou inválida',
        sessionExpired: true
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor'
  })
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