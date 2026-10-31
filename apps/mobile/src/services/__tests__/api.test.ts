import { analyze, analyzeTarget, detectAnalyzeType, getMetrics, isAppError, sendFeedback } from '../api';
import type { AppError } from '../api';
import type { AnalyzeResponse } from '../../types/api';

const SECRET = 'minha-chave-pix-123@segredo.com';

const okBody: AnalyzeResponse = {
  type: 'url',
  targetRef: 'a1'.repeat(32),
  report: {
    level: 'NO_KNOWN_INDICATORS',
    label: 'Nenhum Indicador Conhecido Encontrado',
    score: 0,
    signals: [],
    advice: ['Continue atento.'],
    disclaimer: 'Não é 100% infalível.',
    externalCheck: 'disabled',
  },
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

const fake = (impl: (url: string, init?: RequestInit) => Promise<Response>) =>
  jest.fn(impl) as unknown as typeof fetch & jest.Mock;

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (e) {
    expect(isAppError(e)).toBe(true);
    return e as AppError;
  }
  throw new Error('esperava um AppError');
}

describe('analyze', () => {
  it('retorna o relatório em 200 e envia só o corpo esperado', async () => {
    const fetchFn = fake(async () => jsonResponse(200, okBody));
    const res = await analyze({ type: 'url', content: 'exemplo.com' }, { fetchFn });
    expect(res).toEqual(okBody);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/analyze$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ type: 'url', content: 'exemplo.com' });
    expect(Object.keys(init.headers as object).sort()).toEqual(['Accept', 'Content-Type']);
  });

  it('mapeia erro padronizado 422 com details', async () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos. Verifique os campos e tente novamente.',
        details: [{ field: 'type', issue: 'invalid_union' }],
      },
    };
    const fetchFn = fake(async () => jsonResponse(422, body));
    const err = await catchError(analyze({ type: 'url', content: 'x' }, { fetchFn }));
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(422);
    expect(err.message).toBe(body.error.message);
    expect(err.details).toEqual(body.error.details);
  });

  it('429 com Retry-After e corpo padrão', async () => {
    const body = {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas requisições enviadas. Tente novamente mais tarde.' },
    };
    const fetchFn = fake(async () => jsonResponse(429, body, { 'Retry-After': '42' }));
    const err = await catchError(analyze({ type: 'message', content: 'oi' }, { fetchFn }));
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(42);
    expect(err.message).toContain('42 s');
  });

  it('429 com corpo padrão e sem Retry-After', async () => {
    const body = { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'x' } };
    const fetchFn = fake(async () => jsonResponse(429, body));
    const err = await catchError(analyze({ type: 'message', content: 'oi' }, { fetchFn }));
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('429 sem corpo e com Retry-After inválido', async () => {
    const fetchFn = fake(async () => new Response(null, { status: 429, headers: { 'Retry-After': 'abc' } }));
    const err = await catchError(analyze({ type: 'message', content: 'oi' }, { fetchFn }));
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfterSeconds).toBeUndefined();
    expect(err.message).toBe('Muitas verificações em pouco tempo. Aguarde um pouco e tente novamente.');
  });

  it('429 sem corpo e com Retry-After 0', async () => {
    const fetchFn = fake(async () => new Response(null, { status: 429, headers: { 'Retry-After': '0' } }));
    const err = await catchError(analyze({ type: 'message', content: 'oi' }, { fetchFn }));
    expect(err.retryAfterSeconds).toBe(0);
  });

  it('5xx sem corpo padrão vira INTERNAL_ERROR; 4xx sem corpo padrão vira INVALID_RESPONSE', async () => {
    const f500 = fake(async () => new Response('boom', { status: 502 }));
    const e500 = await catchError(analyze({ type: 'url', content: 'x' }, { fetchFn: f500 }));
    expect(e500.code).toBe('INTERNAL_ERROR');
    const f400 = fake(async () => new Response('<html>', { status: 400 }));
    const e400 = await catchError(analyze({ type: 'url', content: 'x' }, { fetchFn: f400 }));
    expect(e400.code).toBe('INVALID_RESPONSE');
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('aborta após 10 s', async () => {
      const fetchFn = fake(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            );
          }),
      );
      const pending = catchError(analyze({ type: 'url', content: SECRET }, { fetchFn }));
      await jest.advanceTimersByTimeAsync(9_999);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      const err = await pending;
      expect(err.code).toBe('TIMEOUT');
    });
  });

  it('falha de rede vira NETWORK_ERROR', async () => {
    const fetchFn = fake(async () => {
      throw new TypeError('Network request failed');
    });
    const err = await catchError(analyze({ type: 'url', content: 'x' }, { fetchFn }));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.status).toBeUndefined();
  });

  it('2xx com corpo não-JSON vira INVALID_RESPONSE', async () => {
    const fetchFn = fake(async () => new Response('não é json', { status: 200 }));
    const err = await catchError(analyze({ type: 'url', content: 'x' }, { fetchFn }));
    expect(err.code).toBe('INVALID_RESPONSE');
  });

  it('a mensagem do AppError nunca contém o conteúdo enviado', async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => {
        throw new TypeError('Network request failed');
      },
      async () => new Response('lixo', { status: 200 }),
      async () => new Response(null, { status: 429 }),
      async () => new Response('x', { status: 500 }),
      async () =>
        jsonResponse(422, { error: { code: 'INVALID_URL', message: 'O link informado não pode ser analisado.' } }),
    ];
    for (const impl of cases) {
      const err = await catchError(analyze({ type: 'message', content: SECRET }, { fetchFn: fake(impl) }));
      expect(err.message).not.toContain(SECRET);
      expect(JSON.stringify(err.details ?? [])).not.toContain(SECRET);
    }
  });
});

describe('detectAnalyzeType', () => {
  it.each(['https://x.com', 'HTTP://exemplo.com/a?b=1', 'banco-seguro.com.br/login', 'www.exemplo.com'])(
    '%s -> url',
    (input) => {
      expect(detectAnalyzeType(input)).toBe('url');
    },
  );

  it.each(['123.456.789-00', '+55 11 91234-5678', '11912345678', 'fulano@exemplo.com', 'clique aqui exemplo.com'])(
    '%s -> message',
    (input) => {
      expect(detectAnalyzeType(input)).toBe('message');
    },
  );
});

describe('analyzeTarget', () => {
  it('faz trim e envia type + content no corpo', async () => {
    const fetchFn = fake(async () => jsonResponse(200, okBody));
    await analyzeTarget('  exemplo.com/pagar  ', { fetchFn });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ type: 'url', content: 'exemplo.com/pagar' });
  });
});

describe('sendFeedback', () => {
  const input = {
    type: 'SCAM_REPORT' as const,
    target: { type: 'url' as const, ref: 'a1'.repeat(32) },
    level: 'HIGH_RISK' as const,
    signalIds: ['DOM-TYPOSQUAT'],
  };

  it('faz POST em /api/v1/feedback com o corpo exato e só os headers esperados', async () => {
    const fetchFn = fake(async () => jsonResponse(201, { status: 'received' }));
    await expect(sendFeedback(input, { fetchFn })).resolves.toEqual({ status: 'received' });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/feedback$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(Object.keys(init.headers as object).sort()).toEqual(['Accept', 'Content-Type']);
  });

  it('mapeia 503 FEEDBACK_UNAVAILABLE', async () => {
    const body = { error: { code: 'FEEDBACK_UNAVAILABLE', message: 'Indisponível.' } };
    const fetchFn = fake(async () => jsonResponse(503, body));
    const err = await catchError(sendFeedback(input, { fetchFn }));
    expect(err.code).toBe('FEEDBACK_UNAVAILABLE');
    expect(err.status).toBe(503);
  });
});

describe('getMetrics', () => {
  it('faz GET em /api/v1/metrics, sem corpo e só com Accept', async () => {
    const body = { since: '2026-10-29' };
    const fetchFn = fake(async () => jsonResponse(200, body));
    await expect(getMetrics({ fetchFn })).resolves.toEqual(body);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/metrics$/);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(Object.keys(init.headers as object)).toEqual(['Accept']);
  });
});
