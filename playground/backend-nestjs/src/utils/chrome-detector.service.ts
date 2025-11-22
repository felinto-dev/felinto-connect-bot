import { Injectable, Logger } from '@nestjs/common';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { execSync } from 'child_process';

interface ChromeEndpointResult {
  available: boolean;
  chromeInfo?: any;
  error?: string;
}

interface ChromeDetectionResult {
  success: boolean;
  endpoint?: string;
  chromeInfo?: any;
  testedEndpoints?: string[];
  lastError?: string;
}

@Injectable()
export class ChromeDetectorService {
  private readonly logger = new Logger(ChromeDetectorService.name);
  private detectedChromeEndpoint: string | null = null;

  constructor(private readonly websocketGateway: WebsocketGateway) {}

  /**
   * Retorna todos os endpoints possíveis na ordem de prioridade
   */
  detectPossibleEndpoints(): string[] {
    const endpoints: string[] = [];

    // docker.for.mac.localhost (melhor para macOS com Docker Desktop)
    endpoints.push('docker.for.mac.localhost:9222');

    // Gateway IP dinâmico via execSync com fallback
    try {
      const gatewayIp = execSync('ip route show | grep default | awk \'{print $3}\'', {
        encoding: 'utf8',
        timeout: 2000
      }).trim();

      if (gatewayIp) {
        endpoints.push(`${gatewayIp}:9222`);
      }
    } catch (error) {
      // Fallback para IP padrão do Docker bridge
      endpoints.push('172.17.0.1:9222');
    }

    // host.docker.internal
    endpoints.push('host.docker.internal:9222');

    // localhost e 127.0.0.1
    endpoints.push('localhost:9222');
    endpoints.push('127.0.0.1:9222');

    return endpoints;
  }

  /**
   * Testa conectividade com um endpoint específico
   */
  async checkChromeEndpoint(endpoint: string): Promise<ChromeEndpointResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://${endpoint}/json/version`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ChromeDetector/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const chromeInfo = await response.json();
        return {
          available: true,
          chromeInfo
        };
      } else {
        return {
          available: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      let errorMessage = 'Desconhecido';

      if (error.name === 'AbortError') {
        errorMessage = 'Timeout (2s)';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Host não encontrado';
      } else {
        errorMessage = error.message || 'Desconhecido';
      }

      return {
        available: false,
        error: errorMessage
      };
    }
  }

  /**
   * Detecção principal de endpoint Chrome com cache
   */
  async detectChromeEndpoint(): Promise<ChromeDetectionResult> {
    // Retornar endpoint cacheado se disponível
    if (this.detectedChromeEndpoint) {
      const cachedResult = await this.checkChromeEndpoint(this.detectedChromeEndpoint);
      if (cachedResult.available) {
        return {
          success: true,
          endpoint: this.detectedChromeEndpoint,
          chromeInfo: cachedResult.chromeInfo
        };
      }
      // Se o cache não for mais válido, limpar
      this.detectedChromeEndpoint = null;
    }

    const possibleEndpoints = this.detectPossibleEndpoints();
    const testedEndpoints: string[] = [];
    let lastError = 'Nenhum endpoint testado';

    await this.websocketGateway.broadcast({
      type: 'info',
      message: '🔍 Testando endpoints do Chrome...'
    });

    for (const endpoint of possibleEndpoints) {
      testedEndpoints.push(endpoint);

      await this.websocketGateway.broadcast({
        type: 'info',
        message: `🔍 Testando ${endpoint}...`
      });

      const result = await this.checkChromeEndpoint(endpoint);

      if (result.available) {
        this.detectedChromeEndpoint = endpoint;

        await this.websocketGateway.broadcast({
          type: 'success',
          message: `✅ Chrome encontrado em ${endpoint}!`
        });

        return {
          success: true,
          endpoint: this.detectedChromeEndpoint,
          chromeInfo: result.chromeInfo
        };
      } else {
        lastError = result.error || 'Erro desconhecido';
        this.logger.warn(`Endpoint ${endpoint} não disponível: ${lastError}`);
      }
    }

    await this.websocketGateway.broadcast({
      type: 'warning',
      message: '⚠️ Chrome não detectado em nenhum endpoint'
    });

    return {
      success: false,
      testedEndpoints,
      lastError
    };
  }

  /**
   * Reseta o cache de endpoint detectado
   */
  resetCache(): void {
    this.detectedChromeEndpoint = null;
    this.logger.log('Cache de endpoint Chrome resetado');
  }

  /**
   * Getter para obter endpoint cacheado
   */
  getCachedEndpoint(): string | null {
    return this.detectedChromeEndpoint;
  }
}