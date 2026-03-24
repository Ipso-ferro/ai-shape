import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

type AiProvider = "moonshot" | "openai-compatible";

const DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_MOONSHOT_MODEL = "moonshot-v1-8k";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const getNumberFromEnv = (value: string | undefined, fallback: number): number => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const hasMoonshotKey = (): boolean => (
    Boolean(process.env.MOONSHOT_API_KEY?.trim())
);

const hasOpenAiKey = (): boolean => (
    Boolean(process.env.OPENAI_API_KEY?.trim())
);

const resolveProvider = (): AiProvider => {
    const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();

    if (
        configuredProvider === "openai"
        || configuredProvider === "openai-compatible"
        || configuredProvider === "openai_compatible"
    ) {
        return "openai-compatible";
    }

    if (hasMoonshotKey()) {
        return "moonshot";
    }

    if (hasOpenAiKey()) {
        return "openai-compatible";
    }

    return "moonshot";
};

const resolveApiKey = (provider: AiProvider): string => {
    const apiKey = provider === "moonshot"
        ? process.env.MOONSHOT_API_KEY?.trim()
        : process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
        throw new Error(
            provider === "moonshot"
                ? "Missing MOONSHOT_API_KEY for Moonshot provider."
                : "Missing OPENAI_API_KEY for OpenAI-compatible provider.",
        );
    }

    return apiKey;
};

const resolveBaseUrl = (provider: AiProvider): string | undefined => {
    const customBaseUrl = process.env.AI_BASE_URL?.trim();

    if (customBaseUrl) {
        return customBaseUrl;
    }

    if (provider === "moonshot") {
        return process.env.MOONSHOT_BASE_URL?.trim() || DEFAULT_BASE_URL;
    }

    return process.env.OPENAI_BASE_URL?.trim() || undefined;
};

export const createOpenAIClient = (): OpenAI => {
    const provider = resolveProvider();
    const apiKey = resolveApiKey(provider);

    return new OpenAI({
        apiKey,
        baseURL: resolveBaseUrl(provider),
    });
};

const provider = resolveProvider();

export const MODEL: string = (() => {
    if (provider === "openai-compatible") {
        return process.env.AI_PLAN_MODEL?.trim()
            || process.env.OPENAI_PLAN_MODEL?.trim()
            || process.env.AI_MODEL?.trim()
            || process.env.OPENAI_MODEL?.trim()
            || DEFAULT_OPENAI_MODEL;
    }

    return process.env.AI_PLAN_MODEL?.trim()
        || process.env.MOONSHOT_PLAN_MODEL?.trim()
        || process.env.AI_MODEL?.trim()
        || process.env.MOONSHOT_MODEL?.trim()
        || DEFAULT_MOONSHOT_MODEL;
})();

export const DIET_PLAN_MAX_TOKENS = getNumberFromEnv(
    process.env.DIET_PLAN_MAX_TOKENS?.trim()
    || process.env.AI_PLAN_MAX_TOKENS?.trim(),
    8000,
);

export const WORKOUT_PLAN_MAX_TOKENS = getNumberFromEnv(
    process.env.WORKOUT_PLAN_MAX_TOKENS?.trim()
    || process.env.AI_PLAN_MAX_TOKENS?.trim(),
    3600,
);

export const SHOPPING_LIST_MAX_TOKENS = getNumberFromEnv(
    process.env.SHOPPING_LIST_MAX_TOKENS?.trim()
    || process.env.AI_PLAN_MAX_TOKENS?.trim(),
    4000,
);

export interface ChatCompletionOptions {
    temperature?: number;
    response_format?: { type: "json_object" | "json_schema" | "text" };
    max_tokens?: number;
}
