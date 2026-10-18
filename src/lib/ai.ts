import { z } from "zod";
import {
  MedicationSchema,
  MilestoneSchema,
  PlanSchema,
  QuestionSchema,
  RestrictionSchema,
  SymptomResultSchema,
  TaskSchema,
  TranslationSchema,
  WarningSchema,
  type Plan,
  type SymptomResult,
} from "./schema";
import { analyzePrompt, symptomPrompt, translatePrompt } from "./prompts";
import { matchSymptom } from "./symptomMatch";
import { toISODate } from "./dates";

// Where the AI runs. Liftoff picks the first that is available:
//  - "artifact": published on claude.ai, using the viewer's own Claude
//    through the artifact runtime's `sample` capability;
//  - "server":   the Node server in /server with an Anthropic API key;
//  - "offline":  no AI (e.g. the public GitHub Pages site). The sample
//                papers use the saved result and the symptom check falls
//                back to keyword matching.

export type AIMode = "artifact" | "server" | "offline";

interface SampleOptions {
  images?: Blob[];
  modelTier?: "quick" | "default" | "complex";
  signal?: AbortSignal;
}
interface SampleFn {
  json<T = unknown>(input: string, options?: SampleOptions): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
}
interface SampleError {
  code: string;
  message: string;
}
declare global {
  interface Window {
    claude?: { use(name: "sample"): Promise<SampleFn | null> };
  }
}

export class AIUnavailableError extends Error {
  constructor() {
    super("No AI connection");
  }
}
export class AIDeclinedError extends Error {
  constructor() {
    super("The viewer declined Claude access");
  }
}

let samplePromise: Promise<SampleFn | null> | null = null;
function artifactSample(): Promise<SampleFn | null> {
  if (!__ARTIFACT__ || !window.claude?.use) return Promise.resolve(null);
  samplePromise ??= window.claude.use("sample").catch(() => null);
  return samplePromise;
}

export async function detectMode(): Promise<AIMode> {
  if (__ARTIFACT__) return (await artifactSample()) ? "artifact" : "offline";
  if (__STATIC__) return "offline"; // public website: no API server behind it
  try {
    const res = await fetch("/api/health");
    if (res.ok && (await res.json()).ai === true) return "server";
  } catch {
    // No server running (e.g. `vite` on its own): offline.
  }
  return "offline";
}

export async function canSendPhotos(mode: AIMode): Promise<boolean> {
  if (mode === "server") return true;
  if (mode !== "artifact") return false;
  const sample = await artifactSample();
  const limits = await sample?.limits().catch(() => null);
  return Boolean(limits?.images);
}

function isSampleError(e: unknown): e is SampleError {
  return typeof e === "object" && e !== null && "code" in e;
}

async function viaArtifact<T>(
  prompt: string,
  parse: (v: unknown) => T,
  options: SampleOptions = {},
): Promise<T> {
  const sample = await artifactSample();
  if (!sample) throw new AIUnavailableError();
  try {
    return parse(await sample.json(prompt, options));
  } catch (e) {
    if (isSampleError(e) && (e.code === "not_granted" || e.code === "sampling_disabled")) {
      throw new AIDeclinedError();
    }
    throw e;
  }
}

async function viaServer<T>(path: string, body: unknown, parse: (v: unknown) => T): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 503) throw new AIUnavailableError();
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return parse(await res.json());
}

// Phone photos are often larger than the API accepts. Claude reads images up
// to 2576 px on the long edge, so scale down to that and re-encode as JPEG.
const MAX_EDGE = 2576;
const MAX_BYTES = 4_500_000;

async function shrinkPhoto(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && photo.size <= MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(photo.type)) {
    bitmap.close();
    return photo;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the photo"))), "image/jpeg", quality),
    );
  const blob = await encode(0.88);
  return blob.size <= MAX_BYTES ? blob : encode(0.7);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// The artifact runtime parses Claude's reply as plain JSON with no schema
// enforcement, so accept small slips: a missing nullable field becomes null,
// and a single malformed item is dropped instead of failing the whole plan.
type Row = Record<string, unknown>;
const asRow = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});

function fillNulls(schema: z.ZodObject, value: unknown): Row {
  const out = { ...asRow(value) };
  for (const [key, field] of Object.entries(schema.shape)) {
    if (!(key in out) && (field as z.ZodType).safeParse(null).success) out[key] = null;
  }
  return out;
}

export function parsePlan(value: unknown): Plan {
  const strict = PlanSchema.safeParse(value);
  if (strict.success) return strict.data;
  const o = asRow(value);
  const list = (schema: z.ZodObject, key: string) =>
    (Array.isArray(o[key]) ? o[key] : []).flatMap((item) => {
      const r = schema.safeParse(fillNulls(schema, item));
      return r.success ? [r.data] : [];
    });
  const restrictions = list(RestrictionSchema, "restrictions") as Plan["restrictions"];
  const lastDay = Math.max(14, ...restrictions.map((r) => r.untilDay ?? 0));
  return PlanSchema.parse({
    transcript: typeof o.transcript === "string" ? o.transcript : null,
    patient: fillNulls(PlanSchema.shape.patient, o.patient),
    summary: typeof o.summary === "string" ? o.summary : "",
    recoveryDays: typeof o.recoveryDays === "number" ? o.recoveryDays : lastDay,
    medications: list(MedicationSchema, "medications"),
    tasks: list(TaskSchema, "tasks"),
    restrictions,
    milestones: list(MilestoneSchema, "milestones"),
    warnings: list(WarningSchema, "warnings"),
    questions: list(QuestionSchema, "questions"),
  });
}

export interface AnalyzeInput {
  text?: string;
  photo?: Blob;
}

export async function analyze(mode: AIMode, input: AnalyzeInput): Promise<Plan> {
  const today = toISODate(new Date());
  if (mode === "artifact") {
    const prompt = analyzePrompt({ text: input.text, photo: !!input.photo, today, includeShape: true });
    return viaArtifact(prompt, parsePlan, {
      modelTier: "default",
      images: input.photo ? [input.photo] : undefined,
    });
  }
  if (mode === "server") {
    const photo = input.photo ? await shrinkPhoto(input.photo) : null;
    const image = photo ? { data: await blobToBase64(photo), mediaType: photo.type } : undefined;
    return viaServer("/api/analyze", { text: input.text, image, today }, parsePlan);
  }
  throw new AIUnavailableError();
}

export async function checkSymptom(
  mode: AIMode,
  plan: Plan,
  doc: string,
  symptom: string,
): Promise<SymptomResult> {
  try {
    if (mode === "artifact") {
      return await viaArtifact(
        symptomPrompt({ plan, doc, symptom, includeShape: true }),
        (v) => SymptomResultSchema.parse(v),
        { modelTier: "quick" },
      );
    }
    if (mode === "server") {
      return await viaServer("/api/symptom", { plan, doc, symptom }, (v) =>
        SymptomResultSchema.parse(v),
      );
    }
  } catch (e) {
    console.warn("AI symptom check failed, using the offline matcher", e);
  }
  return matchSymptom(plan, symptom);
}

export async function translate(
  mode: AIMode,
  strings: string[],
  language: string,
): Promise<string[]> {
  const check = (v: unknown) => {
    const out = TranslationSchema.parse(v).strings;
    if (out.length !== strings.length) throw new Error("Translation returned the wrong number of strings");
    return out;
  };
  if (mode === "artifact") {
    return viaArtifact(translatePrompt({ strings, language, includeShape: true }), check, {
      modelTier: "quick",
    });
  }
  if (mode === "server") return viaServer("/api/translate", { strings, language }, check);
  throw new AIUnavailableError();
}
