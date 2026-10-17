import type { Plan } from "../lib/schema";

// Spanish for the saved sample result, so the language switch works in the
// demo without an AI connection. Quotes are left in English: they are the
// original papers.

const BY_ID: Record<string, Record<string, string>> = {
  "med-ibuprofen": {
    name: "Ibuprofeno",
    purpose: "Dolor e hinchazón",
    note: "Cada 8 horas, con comida, durante 5 días.",
  },
  "med-acetaminophen": {
    name: "Acetaminofén",
    dose: "1,000 mg (2 tabletas de 500 mg)",
    purpose: "Alivio extra del dolor cuando lo necesites",
    limit: "Al menos 6 horas entre dosis. No más de 3,000 mg en 24 horas.",
  },
  "med-docusate": {
    name: "Docusato de sodio",
    purpose: "Ablandador de heces, para evitar el estreñimiento",
    note: "Deja de tomarlo cuando ya no tomes medicina para el dolor.",
  },
  "task-keep-dry": {
    title: "Mantén las heridas limpias y secas",
    detail: "Todavía no te duches. Lava alrededor de las heridas, no encima.",
  },
  "task-shower": {
    title: "Dúchate y seca las heridas con toques",
    detail: "Deja que el agua con jabón corra sobre las heridas. No las frotes.",
  },
  "task-check-incisions": {
    title: "Revisa tus heridas",
    detail: "Busca enrojecimiento, hinchazón o secreción.",
  },
  "task-walk": {
    title: "Sal a caminar",
    detail: "Empieza con caminatas cortas y ve un poco más lejos cada vez.",
  },
  "task-water": {
    title: "Toma un vaso de agua",
    detail: "Intenta tomar 8 vasos hoy.",
  },
  "task-light-food": {
    title: "Come comidas ligeras y suaves",
    detail: "Vuelve a tu comida normal cuando tu estómago lo permita.",
  },
  "task-followup": {
    title: "Cita de control a las 10:30 AM",
    detail: "Dra. Priya Raman, Clínica de Cirugía General.",
  },
  "no-bath": { title: "Sin baños de tina, natación ni jacuzzi" },
  "no-lifting": { title: "No levantes más de 10 lb" },
  "no-sports": { title: "Sin deportes, educación física ni ejercicio fuerte" },
  "no-driving": {
    title: "No manejes",
    condition:
      "Hasta que te muevas sin dolor y ya no tomes medicina recetada para el dolor.",
  },
  "no-pulling-tapes": { title: "No te quites las cintas de la piel" },
  "ms-shower": { title: "Ya puedes ducharte" },
  "ms-school": { title: "Vuelta a la escuela" },
  "ms-tapes": { title: "Se caen las cintas" },
  "ms-followup": { title: "Cita de control" },
  "ms-sports": { title: "Deportes y gimnasio" },
  "warn-fever": { symptom: "Fiebre de más de 101°F (38.3°C)" },
  "warn-incision": { symptom: "Enrojecimiento, hinchazón, calor o pus en una herida" },
  "warn-pain": { symptom: "Dolor que empeora o que no se calma con la medicina" },
  "warn-vomiting": { symptom: "Náuseas o vómitos que no te dejan tomar líquidos" },
  "warn-bowel": { symptom: "No evacuar en 3 días" },
  "warn-breathing": { symptom: "Dificultad para respirar o dolor en el pecho" },
  "warn-belly": { symptom: "Dolor fuerte y repentino en el abdomen que empeora mucho" },
  "q-home-meds": {
    question:
      "¿Cuáles de mis medicinas de casa debo seguir tomando, y es seguro tomarlas con ibuprofeno?",
  },
  "q-tapes": {
    question: "¿Qué hago si las cintas de la piel no se han caído después de 10 días?",
  },
};

export function sampleSpanish(plan: Plan): Plan {
  const out: Plan = structuredClone(plan);
  out.summary =
    "Te quitaron el apéndice por tres cortes pequeños y te estás recuperando bien. Durante las próximas 4 semanas vas a controlar el dolor, mantener limpias tus heridas y volver poco a poco a tu actividad normal.";
  out.patient.procedure = "Extirpación del apéndice (apendicectomía laparoscópica)";
  const lists = [
    out.medications,
    out.tasks,
    out.restrictions,
    out.milestones,
    out.warnings,
    out.questions,
  ] as unknown as Record<string, unknown>[][];
  for (const list of lists) {
    for (const row of list) {
      Object.assign(row, BY_ID[row.id as string] ?? {});
    }
  }
  return out;
}
