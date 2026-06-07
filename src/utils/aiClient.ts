import axios, { AxiosRequestConfig } from 'axios';

const RETRY_DELAYS_MS = [0, 8000, 15000, 25000, 35000];
const TRANSIENT_AI_STATUS_CODES = new Set([502, 503, 504]);
const TRANSIENT_AI_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
]);

interface AxiosLikeError {
  response?: { status?: number };
  code?: string;
}

export function normalizeAiServerUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function postToAi<T>(
  aiServerUrl: string,
  endpoint: string,
  data: unknown,
  config: AxiosRequestConfig = {},
): Promise<T> {
  const baseUrl = normalizeAiServerUrl(aiServerUrl);

  return requestWithAiWakeRetry(async () => {
    const response = await axios.post<T>(`${baseUrl}${endpoint}`, data, {
      ...config,
      timeout: config.timeout ?? 180000,
    });
    return response.data;
  }, baseUrl);
}

async function requestWithAiWakeRetry<T>(
  operation: () => Promise<T>,
  baseUrl: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) await delay(delayMs);

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length - 1;
      if (!isTransientAiAvailabilityError(error) || isLastAttempt) {
        throw error;
      }

      await pingAiHealth(baseUrl).catch(() => undefined);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('AI request failed after retries');
}

async function pingAiHealth(baseUrl: string): Promise<void> {
  await axios.get(`${baseUrl}/ai/health`, { timeout: 20000 });
}

function isTransientAiAvailabilityError(error: unknown): boolean {
  const err = error as AxiosLikeError;
  const status = err.response?.status;
  const code = err.code;

  return (
    (typeof status === 'number' && TRANSIENT_AI_STATUS_CODES.has(status)) ||
    (typeof code === 'string' && TRANSIENT_AI_ERROR_CODES.has(code))
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
