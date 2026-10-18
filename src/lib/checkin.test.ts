import { test } from "node:test";
import assert from "node:assert/strict";
import { flagsFor, rulesFromPlan, type CheckInLog } from "./checkin.ts";
import { samplePlan } from "../data/sample.ts";

const rules = rulesFromPlan(samplePlan());
const entry = (pain: number | null, tempF: number | null, bowel: "yes" | "no" | null) => ({ pain, tempF, bowel });

test("rules come from the papers' own warning signs", () => {
  assert.deepEqual(rules.fever, { warningId: "warn-fever", maxF: 101 });
  assert.deepEqual(rules.pain, { warningId: "warn-pain" });
  assert.deepEqual(rules.bowel, { warningId: "warn-bowel", days: 3 });
});

test("a temperature over the papers' limit raises a fever flag", () => {
  const log: CheckInLog = { 0: entry(5, 99.2, "yes"), 1: entry(4, 101.6, "yes") };
  const flags = flagsFor(log, rules);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].kind, "fever");
  assert.equal(flags[0].day, 1);
  assert.equal(flagsFor({ 0: entry(4, 101, "yes") }, rules).length, 0);
});

test("pain that goes up twice in a row, or jumps 3 points, is flagged", () => {
  assert.equal(flagsFor({ 0: entry(3, null, null), 1: entry(4, null, null), 2: entry(5, null, null) }, rules)[0]?.kind, "pain");
  assert.equal(flagsFor({ 0: entry(2, null, null), 1: entry(5, null, null) }, rules)[0]?.kind, "pain");
  assert.equal(flagsFor({ 0: entry(6, null, null), 1: entry(5, null, null), 2: entry(6, null, null) }, rules).length, 0);
});

test("three 'no' answers in a row trip the bowel rule; unanswered days don't count", () => {
  const log: CheckInLog = { 0: entry(null, null, "no"), 1: entry(null, null, "no"), 2: entry(null, null, "no") };
  const flags = flagsFor(log, rules);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].day, 2);
  assert.equal(flagsFor({ 0: entry(null, null, "no"), 1: entry(null, null, null), 2: entry(null, null, "no") }, rules).length, 0);
});
