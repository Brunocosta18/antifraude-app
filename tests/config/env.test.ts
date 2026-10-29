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

  describe('trust proxy', () => {
    it('padrão é false', () => {
      expect(loadConfig({}).trustProxy).toBe(false);
    });

    it.each([
      ['true', true],
      ['false', false],
      ['1', 1],
      ['10', 10],
    ])('lê TRUST_PROXY=%s', (value, esperado) => {
      expect(loadConfig({ TRUST_PROXY: value }).trustProxy).toBe(esperado);
    });

    it.each(['abc', '0', '11', '1.5'])('rejeita TRUST_PROXY inválido (%s)', (value) => {
      expect(() => loadConfig({ TRUST_PROXY: value })).toThrow(/TRUST_PROXY/);
    });
  });

  describe('feedback (ANTIGOL-017)', () => {
    it('padrões: sem segredo e banco em memória', () => {
      expect(loadConfig({})).toMatchObject({ feedbackHmacSecret: null, feedbackDbPath: ':memory:' });
    });

    it('lê segredo (com trim) e caminho do banco', () => {
      const secret = 'x'.repeat(32);
      expect(loadConfig({ FEEDBACK_HMAC_SECRET: ` ${secret} `, FEEDBACK_DB_PATH: '/tmp/f.db' })).toMatchObject({
        feedbackHmacSecret: secret,
        feedbackDbPath: '/tmp/f.db',
      });
      expect(loadConfig({ FEEDBACK_HMAC_SECRET: '  ' }).feedbackHmacSecret).toBeNull();
    });

    it('rejeita segredo curto sem vazar o valor', () => {
      const act = () => loadConfig({ FEEDBACK_HMAC_SECRET: 'segredo-curto-123' });
      expect(act).toThrow(/FEEDBACK_HMAC_SECRET/);
      expect(act).not.toThrow(/segredo-curto-123/);
    });
  });

  describe('phishing database', () => {
    it('padrões: desligado e refresh de 6 h', () => {
      const config = loadConfig({});
      expect(config.phishingDbEnabled).toBe(false);
      expect(config.phishingDbRefreshMs).toBe(6 * 3_600_000);
    });

    it.each([
      ['true', true],
      ['false', false],
    ])('lê PHISHING_DB_ENABLED=%s', (value, esperado) => {
      expect(loadConfig({ PHISHING_DB_ENABLED: value }).phishingDbEnabled).toBe(esperado);
    });

    it.each(['sim', '1', 'TRUE '])('rejeita PHISHING_DB_ENABLED inválido (%s)', (value) => {
      expect(() => loadConfig({ PHISHING_DB_ENABLED: value })).toThrow(/PHISHING_DB_ENABLED/);
    });

    it('aceita os limites de PHISHING_DB_REFRESH_MS (1 h a 24 h)', () => {
      expect(loadConfig({ PHISHING_DB_REFRESH_MS: '3600000' }).phishingDbRefreshMs).toBe(3_600_000);
      expect(loadConfig({ PHISHING_DB_REFRESH_MS: '86400000' }).phishingDbRefreshMs).toBe(86_400_000);
    });

    it.each(['3599999', '86400001', 'abc'])('rejeita PHISHING_DB_REFRESH_MS inválido (%s)', (value) => {
      expect(() => loadConfig({ PHISHING_DB_REFRESH_MS: value })).toThrow(/PHISHING_DB_REFRESH_MS/);
    });
  });
});
