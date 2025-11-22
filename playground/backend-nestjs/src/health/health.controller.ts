import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Verifica status da aplicação', description: 'Endpoint simples para health check. Retorna status OK e timestamp atual.' })
  @ApiResponse({ status: 200, description: 'Aplicação está saudável', schema: { example: { status: 'OK', timestamp: '2024-01-15T10:30:00.000Z' } } })
  @Get()
  check() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }
}