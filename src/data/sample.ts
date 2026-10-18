import type { Plan } from "../lib/schema";
import type { CheckInLog } from "../lib/checkin";
import { addDays, toISODate } from "../lib/dates";

// A fictional discharge sheet used for the demo. The dates move with the
// calendar so the sample patient is always two days into recovery.

export const SAMPLE_DAYS_SINCE_DISCHARGE = 2;

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("en-US", opts);
const long = (d: Date) => fmt(d, { month: "short", day: "numeric", year: "numeric" });

export function sampleDischargeDate(now = new Date()): Date {
  return addDays(now, -SAMPLE_DAYS_SINCE_DISCHARGE);
}

export function sampleDocument(now = new Date()): string {
  const discharge = sampleDischargeDate(now);
  const surgery = addDays(discharge, -1);
  const followUp = addDays(discharge, 14);
  const weekday = fmt(followUp, { weekday: "short" });

  return `CEDAR RIDGE MEDICAL CENTER
Department of General Surgery
DISCHARGE INSTRUCTIONS             SAMPLE - FICTIONAL PATIENT

Patient: Jordan Lee         DOB: 03/14/2009     MRN: 00482913
Date of discharge: ${long(discharge)}
Procedure: Laparoscopic appendectomy (${long(surgery)})
Surgeon: Priya Raman, MD
Clinic phone: (555) 555-0147    After hours: (555) 555-0199

DIAGNOSIS
Acute appendicitis, uncomplicated. Your appendix was removed
through three small incisions. You are recovering well.

MEDICATIONS
1. Ibuprofen 400 mg by mouth every 8 hours with food for 5 days.
2. Acetaminophen 500 mg, take 2 tablets (1,000 mg) every 6 hours
   as needed for pain. Do not take more than 3,000 mg in 24 hours.
3. Docusate sodium 100 mg by mouth twice daily while taking pain
   medicine, to prevent constipation.
Continue your home medications as before.

INCISION CARE
Keep your incisions clean and dry for 48 hours. After 48 hours
you may shower. Let soapy water run over the incisions and pat
them dry. Do not take baths, swim, or use a hot tub for 2 weeks.
The skin tapes (Steri-Strips) will fall off on their own in 7 to
10 days. Do not pull them off.
Check your incisions every day for redness, swelling, or
drainage.

ACTIVITY
Walk at least 3 times a day. Start with short walks and slowly
go farther.
Do not lift anything heavier than 10 pounds (about a gallon of
milk) for 2 weeks.
No sports, gym class, or strenuous exercise for 4 weeks.
You may return to school in 1 week if your pain is controlled.
Do not drive until you can move without pain and are not taking
prescription pain medicine.

DIET
Start with light, bland foods and return to your normal diet as
tolerated. Drink at least 8 glasses of water a day.

FOLLOW-UP
Follow-up appointment with Dr. Priya Raman at the General
Surgery Clinic on ${weekday}, ${long(followUp)} at 10:30 AM.

CALL YOUR SURGEON IF YOU HAVE:
- Fever higher than 101°F (38.3°C)
- Redness, swelling, warmth, or pus-like drainage at an incision
- Pain that gets worse instead of better, or is not helped by
  your pain medicine
- Nausea or vomiting that keeps you from drinking fluids
- No bowel movement for 3 days

CALL 911 OR GO TO THE NEAREST EMERGENCY ROOM IF YOU HAVE:
- Trouble breathing or chest pain
- Severe belly pain that is sudden and gets much worse

I have received and understand these instructions.
Patient/Guardian signature: ____________________    RN: M. Ortiz
`;
}

/**
 * A saved result for the sample document, so the demo works with no AI
 * connection. It has the same shape Claude returns, and its quotes go through
 * the same source check as a live result.
 */
export function samplePlan(now = new Date()): Plan {
  return {
    transcript: null,
    patient: {
      name: "Jordan Lee",
      procedure: "Appendix removal (laparoscopic appendectomy)",
      dischargeDate: toISODate(sampleDischargeDate(now)),
      careTeam: "Dr. Priya Raman, General Surgery Clinic",
      phone: "(555) 555-0147",
      afterHoursPhone: "(555) 555-0199",
    },
    summary:
      "Your appendix was removed through three small cuts and you are healing well. Over the next 4 weeks you will manage pain, keep your incisions clean, and slowly get back to normal activity.",
    recoveryDays: 28,
    medications: [
      {
        id: "med-ibuprofen",
        name: "Ibuprofen",
        dose: "400 mg",
        purpose: "Pain and swelling",
        times: ["07:00", "15:00", "23:00"],
        asNeeded: false,
        limit: null,
        withFood: true,
        startDay: 0,
        endDay: 4,
        note: "Every 8 hours, with food, for 5 days.",
        quote: "Ibuprofen 400 mg by mouth every 8 hours with food for 5 days.",
      },
      {
        id: "med-acetaminophen",
        name: "Acetaminophen",
        dose: "1,000 mg (2 tablets of 500 mg)",
        purpose: "Extra pain relief when you need it",
        times: [],
        asNeeded: true,
        limit: "At least 6 hours apart. No more than 3,000 mg in 24 hours.",
        withFood: false,
        startDay: 0,
        endDay: null,
        note: null,
        quote:
          "take 2 tablets (1,000 mg) every 6 hours as needed for pain. Do not take more than 3,000 mg in 24 hours.",
      },
      {
        id: "med-docusate",
        name: "Docusate sodium",
        dose: "100 mg",
        purpose: "Stool softener, to prevent constipation",
        times: ["08:00", "20:00"],
        asNeeded: false,
        limit: null,
        withFood: false,
        startDay: 0,
        endDay: null,
        note: "Stop when you no longer take pain medicine.",
        quote:
          "Docusate sodium 100 mg by mouth twice daily while taking pain medicine, to prevent constipation.",
      },
    ],
    tasks: [
      {
        id: "task-keep-dry",
        title: "Keep incisions clean and dry",
        detail: "No shower yet. Wash around the incisions, not over them.",
        category: "wound",
        timesPerDay: 1,
        timeOfDay: "anytime",
        startDay: 0,
        endDay: 1,
        quote: "Keep your incisions clean and dry for 48 hours.",
      },
      {
        id: "task-shower",
        title: "Shower and pat incisions dry",
        detail: "Let soapy water run over the incisions. Don't scrub them.",
        category: "wound",
        timesPerDay: 1,
        timeOfDay: "morning",
        startDay: 2,
        endDay: null,
        quote:
          "After 48 hours you may shower. Let soapy water run over the incisions and pat them dry.",
      },
      {
        id: "task-check-incisions",
        title: "Check your incisions",
        detail: "Look for redness, swelling, or drainage.",
        category: "wound",
        timesPerDay: 1,
        timeOfDay: "morning",
        startDay: 0,
        endDay: null,
        quote: "Check your incisions every day for redness, swelling, or drainage.",
      },
      {
        id: "task-walk",
        title: "Take a walk",
        detail: "Start short and go a little farther each time.",
        category: "activity",
        timesPerDay: 3,
        timeOfDay: "anytime",
        startDay: 0,
        endDay: null,
        quote: "Walk at least 3 times a day. Start with short walks and slowly go farther.",
      },
      {
        id: "task-water",
        title: "Drink a glass of water",
        detail: "Aim for 8 glasses today.",
        category: "diet",
        timesPerDay: 8,
        timeOfDay: "anytime",
        startDay: 0,
        endDay: null,
        quote: "Drink at least 8 glasses of water a day.",
      },
      {
        id: "task-light-food",
        title: "Eat light, bland meals",
        detail: "Go back to your normal food as your stomach allows.",
        category: "diet",
        timesPerDay: 1,
        timeOfDay: "anytime",
        startDay: 0,
        endDay: 3,
        quote:
          "Start with light, bland foods and return to your normal diet as tolerated.",
      },
      {
        id: "task-followup",
        title: "Follow-up visit at 10:30 AM",
        detail: "Dr. Priya Raman, General Surgery Clinic.",
        category: "followup",
        timesPerDay: 1,
        timeOfDay: "morning",
        startDay: 14,
        endDay: 14,
        quote: "Follow-up appointment with Dr. Priya Raman at the General Surgery Clinic",
      },
    ],
    restrictions: [
      {
        id: "no-bath",
        title: "No baths, swimming, or hot tubs",
        untilDay: 14,
        condition: null,
        quote: "Do not take baths, swim, or use a hot tub for 2 weeks.",
      },
      {
        id: "no-lifting",
        title: "No lifting over 10 lb",
        untilDay: 14,
        condition: null,
        quote: "Do not lift anything heavier than 10 pounds (about a gallon of milk) for 2 weeks.",
      },
      {
        id: "no-sports",
        title: "No sports, gym class, or hard exercise",
        untilDay: 28,
        condition: null,
        quote: "No sports, gym class, or strenuous exercise for 4 weeks.",
      },
      {
        id: "no-driving",
        title: "No driving",
        untilDay: null,
        condition: "Until you can move without pain and are off prescription pain medicine.",
        quote:
          "Do not drive until you can move without pain and are not taking prescription pain medicine.",
      },
      {
        id: "no-pulling-tapes",
        title: "Don't pull off the skin tapes",
        untilDay: 10,
        condition: null,
        quote: "will fall off on their own in 7 to 10 days. Do not pull them off.",
      },
    ],
    milestones: [
      {
        id: "ms-shower",
        title: "Shower OK",
        day: 2,
        quote: "After 48 hours you may shower.",
      },
      {
        id: "ms-school",
        title: "Back to school",
        day: 7,
        quote: "You may return to school in 1 week if your pain is controlled.",
      },
      {
        id: "ms-tapes",
        title: "Skin tapes fall off",
        day: 10,
        quote: "The skin tapes (Steri-Strips) will fall off on their own in 7 to 10 days.",
      },
      {
        id: "ms-followup",
        title: "Follow-up visit",
        day: 14,
        quote: "Follow-up appointment with Dr. Priya Raman",
      },
      {
        id: "ms-sports",
        title: "Sports & gym OK",
        day: 28,
        quote: "No sports, gym class, or strenuous exercise for 4 weeks.",
      },
    ],
    warnings: [
      {
        id: "warn-fever",
        symptom: "Fever higher than 101°F (38.3°C)",
        level: "call_doctor",
        quote: "Fever higher than 101°F (38.3°C)",
      },
      {
        id: "warn-incision",
        symptom: "Redness, swelling, warmth, or pus at an incision",
        level: "call_doctor",
        quote: "Redness, swelling, warmth, or pus-like drainage at an incision",
      },
      {
        id: "warn-pain",
        symptom: "Pain that gets worse, or pain medicine doesn't help",
        level: "call_doctor",
        quote:
          "Pain that gets worse instead of better, or is not helped by your pain medicine",
      },
      {
        id: "warn-vomiting",
        symptom: "Nausea or vomiting that stops you from drinking",
        level: "call_doctor",
        quote: "Nausea or vomiting that keeps you from drinking fluids",
      },
      {
        id: "warn-bowel",
        symptom: "No bowel movement for 3 days",
        level: "call_doctor",
        quote: "No bowel movement for 3 days",
      },
      {
        id: "warn-breathing",
        symptom: "Trouble breathing or chest pain",
        level: "call_911",
        quote: "Trouble breathing or chest pain",
      },
      {
        id: "warn-belly",
        symptom: "Sudden, severe belly pain that gets much worse",
        level: "call_911",
        quote: "Severe belly pain that is sudden and gets much worse",
      },
    ],
    questions: [
      {
        id: "q-home-meds",
        question:
          "Which of my usual home medicines should I keep taking, and are they safe with ibuprofen?",
        quote: "Continue your home medications as before.",
      },
      {
        id: "q-tapes",
        question: "What should I do if the skin tapes haven't come off after 10 days?",
        quote: "The skin tapes (Steri-Strips) will fall off on their own in 7 to 10 days.",
      },
    ],
  };
}

/** Check-ins the sample patient "already logged" on days 0 and 1. */
export function sampleCheckIns(): CheckInLog {
  return {
    0: { pain: 6, tempF: 99.4, bowel: "no" },
    1: { pain: 5, tempF: 99.1, bowel: "no" },
  };
}
