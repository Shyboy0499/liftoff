import { useEffect, useMemo, useState } from "react";
import type { Plan } from "./lib/schema";
import {
  AIDeclinedError,
  AIUnavailableError,
  analyze,
  canSendPhotos,
  detectMode,
  translate,
  type AIMode,
} from "./lib/ai";
import { TraceProvider, UIProvider } from "./lib/context";
import { EN, ES, LANGUAGES, type UIKey, type UIStrings } from "./lib/i18n";
import { applyPlanStrings, planStrings } from "./lib/translate";
import { toneForSource } from "./lib/tones";
import { inDocumentOrder, verifyPlan } from "./lib/verify";
import { sampleDocument, samplePlan } from "./data/sample";
import { sampleSpanish } from "./data/sample.es";
import { Dashboard } from "./components/Dashboard";
import { Landing, type ScanInput } from "./components/Landing";
import type { PaperSource } from "./components/Paper";
import { ScanView } from "./components/ScanView";

type Stage = "landing" | "scanning" | "plan";
type Origin = "live" | "saved";

interface Loaded {
  plan: Plan;
  doc: string;
  origin: Origin;
  isSample: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [mode, setMode] = useState<AIMode>("offline");
  const [canPhoto, setCanPhoto] = useState(false);
  const [stage, setStage] = useState<Stage>("landing");
  const [scanDoc, setScanDoc] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lang, setLang] = useState("en");
  const [translations, setTranslations] = useState<Record<string, { ui: UIStrings; plan: Plan }>>({});
  const [translating, setTranslating] = useState(false);
  const sampleText = useMemo(() => sampleDocument(), []);

  useEffect(() => {
    detectMode().then(async (m) => {
      setMode(m);
      setCanPhoto(await canSendPhotos(m));
    });
  }, []);

  useEffect(() => window.scrollTo(0, 0), [stage]);

  const ui = translations[lang]?.ui ?? (lang === "es" ? ES : EN);
  const t = (k: UIKey) => ui[k] ?? EN[k];

  const startScan = async (input: ScanInput) => {
    setError(null);
    setNotice(null);
    setLoaded(null);
    setTranslations({});
    setLang("en");
    const isSample = input.kind === "sample";
    const text = input.kind === "photo" ? "" : input.text;
    setScanDoc(text);
    setPhotoUrl(input.kind === "photo" ? URL.createObjectURL(input.photo) : null);
    setStage("scanning");

    try {
      let plan: Plan;
      let origin: Origin = "live";
      if (mode === "offline" && isSample) {
        await wait(2600); // let the scan animation play; the result is saved
        plan = samplePlan();
        origin = "saved";
      } else {
        try {
          plan = await analyze(mode, input.kind === "photo" ? { photo: input.photo } : { text });
        } catch (e) {
          if (isSample && e instanceof AIDeclinedError) {
            setNotice(t("errorDeclined"));
            plan = samplePlan();
            origin = "saved";
          } else throw e;
        }
      }
      const doc = input.kind === "photo" ? (plan.transcript ?? "") : text;
      setScanDoc(doc);
      setLoaded({ plan, doc, origin, isSample });
    } catch (e) {
      console.error(e);
      setError(e instanceof AIUnavailableError ? t("errorNoAI") : t("errorGeneric"));
      setStage("landing");
    }
  };

  const sources = useMemo(() => (loaded ? verifyPlan(loaded.plan, loaded.doc) : null), [loaded]);
  const paperSources = useMemo<PaperSource[] | null>(
    () =>
      loaded && sources
        ? inDocumentOrder(sources).map((s) => ({ ...s, tone: toneForSource(loaded.plan, s) }))
        : null,
    [loaded, sources],
  );

  const langAvailable = (code: string) =>
    code === "en" ||
    Boolean(translations[code]) ||
    mode !== "offline" ||
    (code === "es" && loaded?.origin === "saved");

  const changeLang = async (code: string) => {
    if (!loaded || code === "en" || translations[code]) return setLang(code);
    if (code === "es" && loaded.origin === "saved") {
      setTranslations((tr) => ({ ...tr, es: { ui: ES, plan: sampleSpanish(loaded.plan) } }));
      return setLang(code);
    }
    const language = LANGUAGES.find((l) => l.code === code)?.english ?? code;
    const uiKeys = Object.keys(EN) as UIKey[];
    const builtIn = code === "es" ? ES : null;
    const strings = [...(builtIn ? [] : uiKeys.map((k) => EN[k])), ...planStrings(loaded.plan)];
    setTranslating(true);
    try {
      const out = await translate(mode, strings, language);
      const uiOut = builtIn ?? (Object.fromEntries(uiKeys.map((k, i) => [k, out[i]])) as UIStrings);
      const planOut = applyPlanStrings(loaded.plan, out.slice(builtIn ? 0 : uiKeys.length));
      setTranslations((tr) => ({ ...tr, [code]: { ui: uiOut, plan: planOut } }));
      setLang(code);
    } catch (e) {
      console.error(e);
      setNotice(t("errorGeneric"));
    } finally {
      setTranslating(false);
    }
  };

  const reset = () => {
    setStage("landing");
    setLoaded(null);
    setLang("en");
    setTranslations({});
  };

  const originLabel = loaded ? (loaded.origin === "saved" ? t("savedResult") : t("liveResult")) : null;
  const shownPlan = loaded ? (translations[lang]?.plan ?? loaded.plan) : null;

  return (
    <UIProvider strings={ui} locale={lang}>
      {stage === "landing" && (
        <Landing mode={mode} canPhoto={canPhoto} sampleText={sampleText} error={error} onScan={startScan} />
      )}
      {stage === "scanning" && (
        <ScanView
          text={scanDoc}
          photoUrl={photoUrl}
          sources={paperSources}
          originLabel={originLabel}
          onLaunch={() => setStage("plan")}
        />
      )}
      {stage === "plan" && loaded && shownPlan && sources && paperSources && (
        <TraceProvider sources={sources}>
          <Dashboard
            plan={shownPlan}
            doc={loaded.doc}
            paperSources={paperSources}
            mode={mode}
            originLabel={originLabel ?? ""}
            lang={lang}
            setLang={changeLang}
            langAvailable={langAvailable}
            translating={translating}
            onReset={reset}
          />
        </TraceProvider>
      )}
      {notice && (
        <div className="notice" role="status" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
    </UIProvider>
  );
}
