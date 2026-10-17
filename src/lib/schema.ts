import { z } from "zod";

// The recovery plan Claude builds from a discharge document. The same schema
// constrains the server's structured output and validates what the artifact
// runtime returns, so both paths hand the UI the same shape.

const quote = z
  .string()
  .describe(
    "Exact words copied from the document (5 to 30 words) that support this item. Never paraphrase.",
  );

const day = z
  .number()
  .describe("Whole days after discharge. The discharge day is day 0.");

export const CATEGORIES = [
  "medication",
  "wound",
  "activity",
  "diet",
  "followup",
] as const;

export const MedicationSchema = z.object({
  id: z.string().describe('Short unique id such as "med-ibuprofen"'),
  name: z.string(),
  dose: z.string().describe('Amount per dose in plain words, e.g. "400 mg (2 tablets)"'),
  purpose: z.string().describe("What it is for, in plain language"),
  times: z
    .array(z.string())
    .describe(
      'Scheduled dose times as 24-hour "HH:MM", spaced to match the written frequency. Empty for as-needed medicines.',
    ),
  asNeeded: z.boolean(),
  limit: z
    .string()
    .nullable()
    .describe("A written maximum or safety limit, if the document gives one"),
  withFood: z.boolean(),
  startDay: day,
  endDay: day.nullable().describe("Last day to take it, or null if no end is written"),
  note: z.string().nullable(),
  quote,
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().describe("Short action, 3 to 8 words"),
  detail: z.string().describe("One plain-language sentence"),
  category: z.enum(CATEGORIES),
  timesPerDay: z.number().describe("How many times a day to do it (1 if once)"),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "anytime"]),
  startDay: day,
  endDay: day.nullable().describe("Last day, or null if it continues through recovery"),
  quote,
});

export const RestrictionSchema = z.object({
  id: z.string(),
  title: z.string().describe('What not to do yet, e.g. "No lifting over 10 lb"'),
  untilDay: day
    .nullable()
    .describe("First day it is allowed again, or null if it depends on a condition"),
  condition: z
    .string()
    .nullable()
    .describe("When untilDay is null, the condition that ends the restriction"),
  quote,
});

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string().describe("2 to 5 words"),
  day,
  quote,
});

export const WarningSchema = z.object({
  id: z.string(),
  symptom: z.string().describe("The warning sign in plain words"),
  level: z.enum(["call_doctor", "call_911"]),
  quote,
});

export const QuestionSchema = z.object({
  id: z.string(),
  question: z.string().describe("A question the patient should ask their care team"),
  quote,
});

export const PlanSchema = z.object({
  transcript: z
    .string()
    .nullable()
    .describe(
      "Only when the document came as a photo: the full text of the document, transcribed line by line. Otherwise null.",
    ),
  patient: z.object({
    name: z.string().nullable(),
    procedure: z.string().nullable().describe("Plain-language name of the procedure or stay"),
    dischargeDate: z.string().nullable().describe("YYYY-MM-DD"),
    careTeam: z.string().nullable().describe("Doctor or clinic named for follow-up questions"),
    phone: z.string().nullable(),
    afterHoursPhone: z.string().nullable(),
  }),
  summary: z.string().describe("Two plain-language sentences about the recovery ahead"),
  recoveryDays: day.describe(
    "Day when the last written restriction ends, i.e. the expected return to full activity",
  ),
  medications: z.array(MedicationSchema),
  tasks: z.array(TaskSchema),
  restrictions: z.array(RestrictionSchema),
  milestones: z.array(MilestoneSchema),
  warnings: z.array(WarningSchema),
  questions: z.array(QuestionSchema),
});

export const SymptomResultSchema = z.object({
  level: z.enum(["call_911", "call_doctor", "expected", "not_covered"]),
  warningId: z
    .string()
    .nullable()
    .describe("id of the matching warning from the plan, if any"),
  quote: z
    .string()
    .nullable()
    .describe("Exact words from the document that this answer is based on"),
  message: z.string().describe("One or two calm, plain-language sentences"),
});

export const TranslationSchema = z.object({
  strings: z.array(z.string()),
});

export type Plan = z.infer<typeof PlanSchema>;
export type Medication = z.infer<typeof MedicationSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Restriction = z.infer<typeof RestrictionSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Warning = z.infer<typeof WarningSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Category = (typeof CATEGORIES)[number];
export type SymptomResult = z.infer<typeof SymptomResultSchema>;
