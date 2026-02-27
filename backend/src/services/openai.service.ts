import OpenAI from "openai";
import { env } from "../config/env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

function extractContent(messageContent: unknown): string {
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (!Array.isArray(messageContent)) {
    return "";
  }
  return messageContent
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part === "object" && "text" in part) {
        const value = (part as { text?: unknown }).text;
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .join("");
}

type GenerateJsonArgs = {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

export async function generateJsonFromAi<T>(args: GenerateJsonArgs): Promise<T> {
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.schemaName,
          strict: true,
          schema: args.schema
        }
      }
    });
  } catch (cause) {
    const error = new Error("OpenAI request failed") as Error & {
      statusCode?: number;
      cause?: unknown;
    };
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }

  const rawContent = completion.choices?.[0]?.message?.content;
  const content = extractContent(rawContent);
  if (!content) {
    const error = new Error("AI response did not return content") as Error & { statusCode?: number };
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    const error = new Error("AI response returned invalid JSON") as Error & { statusCode?: number };
    error.statusCode = 502;
    throw error;
  }
}
