# Liftoff: Devpost write-up

Copy each section into the matching Devpost field. Edit freely; it's written in first person because this is a solo project.

**Tagline:** Every recovery needs a launchpad.

**One-line description:** Liftoff turns hospital discharge papers into a day-by-day recovery plan, and links every step back to the exact line the care team wrote.

---

## Inspiration

When people leave the hospital, they get a stack of instructions: which medicines to take and when, how to care for incisions, what not to do yet, and which symptoms mean "call your doctor" or "call 911". They get these papers right when they're tired, in pain and starting new medicines. It's easy to forget a dose, misread a limit or miss a warning sign, and those mistakes can send someone back to the hospital.

AI is good at turning dense text into something readable, but in healthcare "readable" isn't enough. If an AI summary invents a dose or drops a warning, that's dangerous. I wanted a tool that makes discharge papers easy to follow without asking the patient to trust the AI blindly.

## What it does

Liftoff reads discharge papers (pasted text or a photo) and builds a recovery plan:

- **Recovery path:** a "flight profile" from discharge day to full activity, with milestones from the papers (shower OK, back to school, follow-up visit, sports OK) and a rocket at today.
- **Today's checklist:** doses and tasks by time of day, with counters for repeated tasks like walks and glasses of water. Finishing the day fires the rocket.
- **Pill clock:** a 24-hour dial with every dose and a countdown to the next one.
- **Daily check-in:** log pain, temperature and bowel movements in a few taps. Liftoff charts them against the limits in the papers. A fever over the papers' 101°F limit, pain that keeps rising, or 3 days without a bowel movement raises an alert that quotes the line and shows who to call.
- **Visit summary:** one tap turns the log into a summary for the follow-up appointment: check-ins, doses taken, alerts and open questions.
- **When to get help:** the papers' own 911 signs and call-your-doctor signs, with the clinic numbers.
- **Symptom check:** type how you feel and Liftoff checks it only against the warning signs in your papers, quoting the line it matched.
- **Questions for the care team:** when the papers are unclear, Liftoff writes a question instead of guessing.
- **Languages and read aloud:** switch the plan to Spanish, Chinese, Vietnamese or Tagalog, or have today's list read out.

The key feature is the **source check**. Claude has to attach an exact quote from the papers to every item. Then plain code (not AI) searches the original text for that quote. If it's found, the item links to the highlighted line, and tapping **Source** draws a line from the plan to the sentence on the papers. If it isn't found, the item is flagged so the patient checks with their care team.

## How I built it

- **Claude** turns the papers into a structured JSON plan. The plan schema is written once in Zod and used two ways: the Node/Express server sends it to the Anthropic API as a structured-output format, and the published claude.ai artifact validates replies from the viewer's own Claude against the same schema.
- **The source check** compares letters and digits only, so line breaks and punctuation in the papers don't break a match, but a changed word or number does.
- **Frontend:** React, TypeScript and Vite. The flight profile and pill clock are hand-drawn SVG; the trace line is an SVG overlay that follows the item and the highlighted text as you scroll.
- **Check-in alerts** follow the same rule as the source check: code, not AI, decides. Liftoff reads the limits straight out of the papers' warning signs ("Fever higher than 101°F", "No bowel movement for 3 days") and compares each day's log with them.
- **Offline mode:** with no API key, the sample papers load a saved result with the same shape, so the demo always works.
- **Public website:** a GitHub Actions workflow builds a static version and publishes it to GitHub Pages, so anyone can try it without logging in.
- **Demo video:** recorded with a Playwright script that drives the app, adds captions and a cursor, and pipes frames to ffmpeg.

## Challenges I ran into

- **Making AI output checkable.** Asking for a quote with every item was easy; making the match robust was harder. Real papers have line breaks in the middle of sentences, bullet marks and odd punctuation, so I match on normalized letters and digits and map the result back to the original text for highlighting.
- **Overlapping sources.** One sentence can support several items (a limit and a milestone, for example), so the papers view splits text at every quote boundary and lets one highlight belong to several items.
- **Day math.** "For 5 days", "after 48 hours" and "for 2 weeks" all need to land on the right day. I spelled out the counting rules in the prompt and kept day numbers relative to the discharge date.
- **Translation without losing the source check.** Translated plans keep the original quotes, so the links still point at real words on the papers.

## Accomplishments I'm proud of

- Every item in the sample plan (29 of 29) traces back to a real line on the papers, and anything that doesn't would be flagged automatically.
- The trace line from a plan item to the highlighted sentence makes the safety check visible instead of hidden.
- The daily check-in closes the loop: the same papers that made the plan also decide when a symptom needs a call, and the visit summary brings everything back to the care team.
- It works on phones, in light and dark mode, and with no API key for the demo.

## What I learned

- In healthcare, the hard part of an AI feature is earning trust, not generating text. Pairing the model with a simple deterministic check made the whole app feel safer.
- Structured outputs make an AI feature much easier to build a UI around.

## What's next

- Test with real (de-identified) discharge papers from several kinds of stays.
- Reminders for doses, tasks and the daily check-in.
- A caregiver view so family members can help track recovery.
- More languages and better read-aloud voices.
- Export a one-page summary to bring to the follow-up visit.

## Built with

React · TypeScript · Vite · Node.js · Express · Zod · Claude (Anthropic API, structured outputs + vision) · GitHub Pages · GitHub Actions · Playwright · ffmpeg

---

**Note for judges:** the sample patient, hospital and phone numbers are fictional. Liftoff only reorganizes what the care team wrote and never adds medical advice.
