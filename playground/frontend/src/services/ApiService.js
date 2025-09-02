export default class ApiService {

  async _fetch(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, options);
      const result = await response.json();

      if (!response.ok) {
        // Lançar um erro que pode ser capturado pelo chamador
        const error = new Error(result.error || 'Erro na API');
        error.details = result;
        throw error;
      }

      return result;
    } catch (error) {
      // Re-lançar o erro para ser tratado no local da chamada
      throw new Error(error.message || 'Erro de conexão com a API');
    }
  }

  checkChromeStatus() {
    return this._fetch('/api/chrome/check');
  }

  async validateWebSocketEndpoint(endpoint) {
    // Este método é um pouco diferente, pois não acessa nossa API principal
    // e precisa de uma lógica de timeout customizada.
    try {
      const wsUrl = new URL(endpoint);
      const httpUrl = `http://${wsUrl.host}/json/version`;

      const response = await fetch(httpUrl, {
        signal: AbortSignal.timeout(5000) // 5 segundos de timeout
      });

      if (!response.ok) {
        throw new Error(`Endpoint não respondeu (HTTP ${response.status})`);
      }

      return await response.json();
    } catch (error) {
       if (error.name === 'AbortError') {
        throw new Error('Timeout na conexão (5s)');
      }
      throw error;
    }
  }

  executeSession(config) {
    return this._fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  createSession(config) {
    return this._fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  executeCode(sessionId, code) {
    return this._fetch('/api/session/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code })
    });
  }

  takeScreenshot(sessionId) {
    return this._fetch('/api/session/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        options: { fullPage: false }
      })
    });
  }
  
  closeSession(sessionId) {
    return this._fetch(`/api/session/${sessionId}`, {
      method: 'DELETE'
    });
  }

  getDocumentation() {
    return this._fetch('/api/docs');
  }
}
