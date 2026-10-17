import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  PlanSchema,
  SymptomResultSchema,
  TranslationSchema,
} from "../src/lib/schema.ts";
import { analyzePrompt, symptomPrompt, translatePrompt } from "../src/lib/prompts.ts";

// Read ANTHROPIC_API_KEY (and friends) from a local .env file if there is one.
if (existsSync(".env")) process.loadEnvFile(".env");

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.LIFTOFF_MODEL ?? "claude-opus-5-5";
const hasCredentials = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
);
const client = hasCredentials ? new Anthropic() : null;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Effort = "low" | "medium" | "high";

// One structured-output call. `fallbacks: "default"` lets the API retry on a
// fallback model if a safety classifier declines the request.
async function structured<S extends z.ZodType>(
  schema: S,
  content: string | Anthropic.Beta.BetaContentBlockParam[],
  effort: Effort,
): Promise<z.infer<S>> {
  if (!client) throw new HttpError(503, "Set ANTHROPIC_API_KEY to enable AI features.");
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "Claude declined to process this document.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new HttpError(502, "The plan was too long to finish. Try a shorter document.");
  }
  if (!response.parsed_output) throw new HttpError(502, "Claude returned no plan.");
  return response.parsed_output;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const AnalyzeBody = z.object({
  text: z.string().max(60_000).optional(),
  image: z
    .object({ data: z.string(), mediaType: z.enum(IMAGE_TYPES) })
    .optional(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const SymptomBody = z.object({
  plan: PlanSchema,
  doc: z.string().max(60_000),
  symptom: z.string().min(1).max(1_000),
});

const TranslateBody = z.object({
  strings: z.array(z.string().max(2_000)).max(400),
  language: z.string().min(2).max(40),
});

const app = express();
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ai: hasCredentials, model: hasCredentials ? MODEL : null });
});

app.post("/api/analyze", async (req, res) => {
  const body = AnalyzeBody.parse(req.body);
  if (!body.text?.trim() && !body.image) throw new HttpError(400, "Send text or a photo.");

  const prompt = analyzePrompt({
    text: body.image ? undefined : body.text,
    photo: Boolean(body.image),
    today: body.today,
    includeShape: false,
  });
  const content: Anthropic.Beta.BetaContentBlockParam[] = body.image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: body.image.mediaType, data: body.image.data },
        },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  res.json(await structured(PlanSchema, content, "medium"));
});

app.post("/api/symptom", async (req, res) => {
  const body = SymptomBody.parse(req.body);
  const prompt = symptomPrompt({ ...body, includeShape: false });
  res.json(await structured(SymptomResultSchema, prompt, "low"));
});

app.post("/api/translate", async (req, res) => {
  const body = TranslateBody.parse(req.body);
  const prompt = translatePrompt({ ...body, includeShape: false });
  res.json(await structured(TranslationSchema, prompt, "low"));
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", issues: err.issues });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: "Too many requests to Claude. Try again in a minute." });
  } else if (err instanceof Anthropic.APIError) {
    console.error("Claude API error", err.status, err.message);
    res.status(502).json({ error: "Claude API error" });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(
    `Liftoff API on http://localhost:${PORT} (${hasCredentials ? `AI on, ${MODEL}` : "AI off: set ANTHROPIC_API_KEY"})`,
  );
});
