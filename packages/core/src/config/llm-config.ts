export type LlmProvider = 'anthropic' | 'openai' | 'ollama';

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
  enabled: boolean;
}

let cached: LlmConfig | null = null;

function resolveProvider(): LlmProvider {
  const explicit = process.env.MASTYFF_AI_LLM_PROVIDER?.toLowerCase();
  if (explicit === 'anthropic' || explicit === 'openai' || explicit === 'ollama') {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'ollama';
}

function defaultModelForProvider(provider: LlmProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-haiku-4-5-20251001';
    case 'openai':
      return 'gpt-4o-mini';
    case 'ollama':
      return 'qwen3:8b';
  }
}

export function getLlmConfig(): LlmConfig {
  if (cached) return cached;

  const provider = resolveProvider();
  const model = process.env.MASTYFF_AI_LLM_MODEL || defaultModelForProvider(provider);

  cached = {
    provider,
    model,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    ollamaBaseUrl:
      process.env.OLLAMA_BASE_URL ||
      process.env.OLLAMA_URL ||
      'http://localhost:11434',
    maxTokens: parseInt(process.env.MASTYFF_AI_LLM_MAX_TOKENS || '512', 10),
    timeoutMs: parseInt(
      process.env.MASTYFF_AI_SEMANTIC_LLM_TIMEOUT_MS
        || process.env.MASTYFF_AI_LLM_TIMEOUT_MS
        || '30000',
      10,
    ),
    temperature: parseFloat(process.env.MASTYFF_AI_LLM_TEMPERATURE || '0.1'),
    enabled: process.env.MASTYFF_AI_LLM_ENABLED !== 'false',
  };
  return cached;
}

export function resetLlmConfigForTests(): void {
  cached = null;
}
