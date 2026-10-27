import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '../../src/config/env.js';

describe('loadConfig', () => {
  it('aplica valores padrão seguros', () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 3000,
      logLevel: 'info',
      corsOrigin: ['http://localhost:8081'],
    });
    expect(config.appVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('converte PORT e separa a lista de origens', () => {
    const config = loadConfig({
      PORT: '8080',
      CORS_ORIGIN: ' http://localhost:8081 , https://app.exemplo.com.br ,',
    });

    expect(config.port).toBe(8080);
    expect(config.corsOrigin).toEqual(['http://localhost:8081', 'https://app.exemplo.com.br']);
  });

  it('aceita "*" fora de produção', () => {
    expect(loadConfig({ NODE_ENV: 'development', CORS_ORIGIN: '*' }).corsOrigin).toBe(true);
  });

  it('rejeita "*" em produção', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', CORS_ORIGIN: '*' })).toThrow(ConfigError);
  });

  it.each(['abc', '0', '70000'])('rejeita PORT inválida (%s)', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/PORT/);
  });

  it('rejeita lista de origens vazia', () => {
    expect(() => loadConfig({ CORS_ORIGIN: ' , ' })).toThrow(/CORS_ORIGIN/);
  });

  it('não ecoa o valor recebido na mensagem de erro', () => {
    expect(() => loadConfig({ PORT: 'valor-secreto' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('valor-secreto') }),
    );
  });

  describe('threat feed', () => {
    it('chave vazia ou ausente vira null e o prazo padrão é 2000 ms', () => {
      expect(loadConfig({ URLHAUS_AUTH_KEY: '  ' })).toMatchObject({ urlhausAuthKey: null, threatFeedTimeoutMs: 2000 });
      expect(loadConfig({}).urlhausAuthKey).toBeNull();
    });

    it('lê a chave e o prazo', () => {
      expect(loadConfig({ URLHAUS_AUTH_KEY: ' abc ', THREAT_FEED_TIMEOUT_MS: '500' })).toMatchObject({
        urlhausAuthKey: 'abc',
        threatFeedTimeoutMs: 500,
      });
    });

    it.each(['2001', '99', 'abc'])('rejeita THREAT_FEED_TIMEOUT_MS inválido (%s)', (value) => {
      expect(() => loadConfig({ THREAT_FEED_TIMEOUT_MS: value })).toThrow(/THREAT_FEED_TIMEOUT_MS/);
    });
  });

  describe('rate limit', () => {
    it('padrão é 30 requisições por 60000 ms', () => {
      expect(loadConfig({})).toMatchObject({ rateLimitMax: 30, rateLimitWindowMs: 60000 });
    });

    it('lê o limite e a janela', () => {
      expect(loadConfig({ RATE_LIMIT_MAX: '5', RATE_LIMIT_WINDOW_MS: '1000' })).toMatchObject({
        rateLimitMax: 5,
        rateLimitWindowMs: 1000,
      });
    });

    it.each(['0', '10001', 'abc'])('rejeita RATE_LIMIT_MAX inválido (%s)', (value) => {
      expect(() => loadConfig({ RATE_LIMIT_MAX: value })).toThrow(/RATE_LIMIT_MAX/);
    });

    it.each(['999', '3600001', 'abc'])('rejeita RATE_LIMIT_WINDOW_MS inválido (%s)', (value) => {
      expect(() => loadConfig({ RATE_LIMIT_WINDOW_MS: value })).toThrow(/RATE_LIMIT_WINDOW_MS/);
    });
  });
});
