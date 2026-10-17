import { test } from "node:test";
import assert from "node:assert/strict";
import { locate, verifyPlan } from "./verify.ts";
import { sampleDocument, samplePlan } from "../data/sample.ts";
import { matchSymptom } from "./symptomMatch.ts";
import { checklistFor, restrictionStates } from "./schedule.ts";
import { applyPlanStrings, planStrings } from "./translate.ts";
import { sampleSpanish } from "../data/sample.es.ts";
import { parsePlan } from "./ai.ts";

test("every quote in the saved sample result is found in the sample papers", () => {
  const doc = sampleDocument();
  const sources = verifyPlan(samplePlan(), doc);
  const missing = [...sources.values()].filter((s) => !s.span).map((s) => s.id);
  assert.deepEqual(missing, []);
});

test("locate ignores line breaks and punctuation but not words", () => {
  const doc = "Do not lift anything heavier than 10 pounds (about a gallon of\nmilk) for 2 weeks.";
  const span = locate(doc, "about a gallon of milk) for 2 weeks");
  assert.ok(span);
  assert.equal(doc.slice(span.start, span.end), "about a gallon of\nmilk) for 2 weeks");
  assert.equal(locate(doc, "for 3 weeks"), null);
  assert.equal(locate(doc, "lift anything heavier than 20 pounds"), null);
});

test("offline symptom check matches warning signs from the papers", () => {
  const plan = samplePlan();
  const red = matchSymptom(plan, "my incision looks red and feels warm");
  assert.equal(red.level, "call_doctor");
  assert.equal(red.warningId, "warn-incision");
  assert.equal(matchSymptom(plan, "I can't breathe and my chest hurts").level, "call_911");
  assert.equal(matchSymptom(plan, "I threw up twice and can't keep water down").level, "call_doctor");
  assert.equal(matchSymptom(plan, "a little itchy around the tape").level, "not_covered");
});

test("day 2 checklist has doses, the first shower and no keep-dry task", () => {
  const items = checklistFor(samplePlan(), 2);
  const keys = items.map((i) => i.key);
  assert.ok(keys.includes("med-ibuprofen@07:00"));
  assert.ok(keys.includes("task-shower"));
  assert.ok(!keys.includes("task-keep-dry"));
  assert.equal(items.find((i) => i.key === "task-water")?.count, 8);
  assert.ok(!checklistFor(samplePlan(), 5).some((i) => i.sourceId === "med-ibuprofen"));
});

test("restrictions count down to their end day", () => {
  const lifting = restrictionStates(samplePlan(), 2).find((r) => r.restriction.id === "no-lifting");
  assert.equal(lifting?.daysLeft, 12);
  assert.equal(lifting?.active, true);
});

test("translation strings round-trip and the Spanish sample keeps quotes", () => {
  const plan = samplePlan();
  const strings = planStrings(plan);
  assert.deepEqual(applyPlanStrings(plan, strings), plan);
  const es = sampleSpanish(plan);
  assert.equal(es.medications[0].quote, plan.medications[0].quote);
  assert.notEqual(es.summary, plan.summary);
});

test("parsePlan fills missing nullable fields and drops broken items", () => {
  const plan = JSON.parse(JSON.stringify(samplePlan()));
  delete plan.transcript;
  delete plan.medications[0].note;
  plan.tasks[0].timeOfDay = "midnight";
  const out = parsePlan(plan);
  assert.equal(out.transcript, null);
  assert.equal(out.medications[0].note, null);
  assert.equal(out.tasks.length, samplePlan().tasks.length - 1);
});
