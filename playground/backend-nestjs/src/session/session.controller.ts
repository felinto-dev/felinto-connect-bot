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
import { SessionService } from './session.service';
import { CreateSessionDto, ExecuteCodeDto, SessionIdDto, ScreenshotOptionsDto } from '../common/dto/session.dto';

@Controller('api/session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

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
      if (error.message === 'Sessão não encontrada') {
        this.sessionService.websocketGateway.broadcast('session_expired', '⏰ A sessão expirou ou foi removida');
        throw new NotFoundException({
          error: 'Sessão não encontrada',
          sessionExpired: true,
          message: 'A sessão expirou ou foi removida. Crie uma nova sessão.',
        });
      }

      throw new InternalServerErrorException({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  @Post('screenshot')
  @HttpCode(HttpStatus.OK)
  async takeScreenshot(
    @Body() body: { sessionId: string; options?: ScreenshotOptionsDto }
  ) {
    const { sessionId, options } = body;

    try {
      this.sessionService.websocketGateway.broadcast('info', '📸 Capturando screenshot');

      const screenshot = await this.sessionService.takeScreenshot(sessionId, options);

      this.sessionService.websocketGateway.broadcast('success', '✅ Screenshot capturado');

      const imageType = options?.quality ? 'jpeg' : 'png';

      return {
        success: true,
        screenshot: `data:image/${imageType};base64,${screenshot}`,
        message: 'Screenshot capturado com sucesso!',
      };
    } catch (error) {
      if (error.message === 'Sessão não encontrada') {
        this.sessionService.websocketGateway.broadcast('session_expired', '⏰ A sessão expirou ou foi removida');
        throw new NotFoundException({
          error: 'Sessão não encontrada',
          sessionExpired: true,
          message: 'A sessão expirou ou foi removida. Crie uma nova sessão.',
        });
      }

      throw new InternalServerErrorException({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

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
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  @Get(':sessionId/validate')
  @HttpCode(HttpStatus.OK)
  async validateSession(@Param('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException({
        success: false,
        valid: false,
        error: 'SessionId é obrigatório',
      });
    }

    try {
      const isValid = await this.sessionService.isSessionValid(sessionId);

      if (isValid) {
        const session = this.sessionService.getSession(sessionId);
        const pageInfo = await this.sessionService.getPageInfo(session.page);

        return {
          success: true,
          valid: true,
          sessionId,
          pageInfo,
        };
      } else {
        return {
          success: false,
          valid: false,
          error: 'Sessão não encontrada ou inválida',
          sessionExpired: true,
        };
      }
    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
  }
}