/**
 * Resolves the active LLM model and per-million token rates in real time.
 * Priority: MCP message metadata → IDE client state (Cline) → env → live litellm rates.
 * Never falls back to a hardcoded default model for billing.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { PricingClient } from '../clients/pricing-client.js';
import { Logger } from '../utils/logger.js';

export type PricingSource = 'cline' | 'cursor' | 'env' | 'message' | 'litellm' | 'unknown';

export interface ResolvedModelPricing {
  modelId: string;
  displayName: string;
  inputPerM: number;
  outputPerM: number;
  source: PricingSource;
  isLive: boolean;
}

export interface CallCostResult {
  costUsd: number;
  model?: string;
  displayName?: string;
  source: PricingSource;
  priced: boolean;
}

const REFRESH_MS = 2000;

export class RuntimeModelPricing {
  private pricingClient = new PricingClient();
  private cached: ResolvedModelPricing | null = null;
  private lastRefresh = 0;

  async getActivePricing(): Promise<ResolvedModelPricing | null> {
    if (Date.now() - this.lastRefresh < REFRESH_MS && this.cached) {
      return this.cached;
    }
    this.cached = await this.detectActivePricing();
    this.lastRefresh = Date.now();
    return this.cached;
  }

  extractModelFromMessage(msg: unknown): string | null {
    if (!msg || typeof msg !== 'object') return null;
    const m = msg as Record<string, unknown>;
    const params = m.params as Record<string, unknown> | undefined;
    if (!params) return null;
    const meta = params._meta as Record<string, unknown> | undefined;
    if (typeof meta?.model === 'string' && meta.model.trim()) return meta.model.trim();
    if (typeof meta?.modelId === 'string' && meta.modelId.trim()) return meta.modelId.trim();
    if (typeof params.model === 'string' && params.model.trim()) return params.model.trim();
    const args = params.arguments;
    if (args && typeof args === 'object') {
      const a = args as Record<string, unknown>;
      if (typeof a.model === 'string' && a.model.trim()) return a.model.trim();
      if (typeof a.modelId === 'string' && a.modelId.trim()) return a.modelId.trim();
    }
    return null;
  }

  async resolveForMessage(msg?: unknown): Promise<ResolvedModelPricing | null> {
    const fromMsg = msg ? this.extractModelFromMessage(msg) : null;
    if (fromMsg) {
      const resolved = await this.resolveModelId(fromMsg);
      if (resolved) return resolved;
    }
    return this.getActivePricing();
  }

  async resolveModelId(modelId: string): Promise<ResolvedModelPricing | null> {
    const active = await this.getActivePricing();
    if (active && this.modelsMatch(active.modelId, modelId)) {
      return active;
    }
    const cline = this.readClinePricing();
    if (cline && this.modelsMatch(cline.modelId, modelId)) {
      return cline;
    }
    const live = await this.pricingClient.getModelPricing(modelId);
    if (live) {
      return {
        modelId,
        displayName: modelId,
        inputPerM: live.input,
        outputPerM: live.output,
        source: 'litellm',
        isLive: live.isLive,
      };
    }
    return null;
  }

  computeCost(
    inputTokens: number,
    outputTokens: number,
    pricing: ResolvedModelPricing | null,
  ): CallCostResult {
    if (!pricing) {
      return { costUsd: 0, source: 'unknown', priced: false };
    }
    const costUsd =
      (inputTokens / 1_000_000) * pricing.inputPerM +
      (outputTokens / 1_000_000) * pricing.outputPerM;
    return {
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      model: pricing.modelId,
      displayName: pricing.displayName,
      source: pricing.source,
      priced: true,
    };
  }

  async computeCostForCall(
    inputTokens: number,
    outputTokens: number,
    msg?: unknown,
  ): Promise<CallCostResult> {
    const pricing = await this.resolveForMessage(msg);
    return this.computeCost(inputTokens, outputTokens, pricing);
  }

  private readClineModelIdOnly(): string | null {
    const statePath = join(homedir(), '.cline', 'data', 'globalState.json');
    if (!existsSync(statePath)) return null;
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
      const id = String(
        state.actModeClineModelId || state.actModeAnthropicModelId || state.actModeOpenAiModelId
        || state.actModeGeminiModelId || state.actModeGroqModelId || state.actModeOpenRouterModelId || '',
      ).trim();
      return id || null;
    } catch {
      return null;
    }
  }

  private async detectActivePricing(): Promise<ResolvedModelPricing | null> {
    const cline = this.readClinePricing();
    if (cline) return cline;

    const clineId = this.readClineModelIdOnly();
    if (clineId) {
      const resolved = await this.resolveModelId(clineId);
      if (resolved) return resolved;
    }

    const envModel = process.env.GUARDIAN_MODEL || process.env.ANTHROPIC_MODEL
      || process.env.OPENAI_MODEL || process.env.MCP_PRICING_MODEL;
    if (envModel?.trim()) {
      return this.resolveModelId(envModel.trim());
    }

    return null;
  }

  private readClinePricing(): ResolvedModelPricing | null {
    const statePath = join(homedir(), '.cline', 'data', 'globalState.json');
    if (!existsSync(statePath)) return null;
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, unknown>;

      const withPrices = (
        modelId: string,
        displayName: string,
        info: { inputPrice?: number; outputPrice?: number },
      ): ResolvedModelPricing | null => {
        if (info.inputPrice == null || info.outputPrice == null) return null;
        return {
          modelId,
          displayName,
          inputPerM: Number(info.inputPrice),
          outputPerM: Number(info.outputPrice),
          source: 'cline',
          isLive: true,
        };
      };

      const clineInfo = state.actModeClineModelInfo as { name?: string; inputPrice?: number; outputPrice?: number } | undefined;
      if (clineInfo) {
        const id = String(state.actModeClineModelId || clineInfo.name || 'cline');
        const row = withPrices(id, clineInfo.name || id, clineInfo);
        if (row) return row;
      }

      const groqInfo = state.actModeGroqModelInfo as { description?: string; inputPrice?: number; outputPrice?: number } | undefined;
      if (groqInfo) {
        const id = String(state.actModeGroqModelId || 'groq');
        const row = withPrices(id, groqInfo.description?.split('.')[0] || id, groqInfo);
        if (row) return row;
      }

      const openRouterInfo = state.actModeOpenRouterModelInfo as { inputPrice?: number; outputPrice?: number } | undefined;
      if (openRouterInfo) {
        const id = String(state.actModeOpenRouterModelId || 'openrouter');
        const row = withPrices(id, id, openRouterInfo);
        if (row) return row;
      }

      const modelIdOnly = String(
        state.actModeAnthropicModelId || state.actModeOpenAiModelId
        || state.actModeGeminiModelId || '',
      ).trim();
      if (modelIdOnly) {
        return null;
      }
    } catch (err) {
      Logger.debug(`[pricing] Cline state read failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }

  private modelsMatch(a: string, b: string): boolean {
    const na = a.toLowerCase().replace(/^models\//, '');
    const nb = b.toLowerCase().replace(/^models\//, '');
    return na === nb || na.includes(nb) || nb.includes(na);
  }
}

let singleton: RuntimeModelPricing | null = null;

export function getRuntimeModelPricing(): RuntimeModelPricing {
  if (!singleton) singleton = new RuntimeModelPricing();
  return singleton;
}
