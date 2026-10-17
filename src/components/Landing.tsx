import { useEffect, useRef, useState } from "react";
import { useUI } from "../lib/context";
import type { AIMode } from "../lib/ai";
import { ArrowIcon, CameraIcon, DocIcon, RocketGlyph } from "./Icons";
import { Paper } from "./Paper";

export type ScanInput =
  | { kind: "sample"; text: string }
  | { kind: "text"; text: string }
  | { kind: "photo"; photo: File };

type Tab = "sample" | "text" | "photo";

export function Landing(props: {
  mode: AIMode;
  canPhoto: boolean;
  sampleText: string;
  error: string | null;
  onScan: (input: ScanInput) => void;
}) {
  const { t } = useUI();
  const [tab, setTab] = useState<Tab>("sample");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return setPhotoUrl(null);
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const offline = props.mode === "offline";
  const needsAI = tab !== "sample" && offline;
  const ready =
    tab === "sample" || (tab === "text" && text.trim().length > 40) || (tab === "photo" && !!photo);

  const scan = () => {
    if (!ready || needsAI) return;
    if (tab === "sample") props.onScan({ kind: "sample", text: props.sampleText });
    else if (tab === "text") props.onScan({ kind: "text", text });
    else if (photo) props.onScan({ kind: "photo", photo });
  };

  return (
    <main className="landing">
      <section className="landing-copy">
        <p className="kicker">
          <RocketGlyph size={18} /> {t("heroKicker")}
        </p>
        <h1 className="hero-title">{t("heroTitle")}</h1>
        <p className="hero-body">{t("heroBody")}</p>

        <ol className="how">
          <li>
            <span className="how-n">1</span>
            {t("howRead")}
          </li>
          <li>
            <span className="how-n">2</span>
            {t("howCheck")}
          </li>
          <li>
            <span className="how-n">3</span>
            {t("howPlan")}
          </li>
        </ol>

        <div className="intake">
          <div className="tabs" role="tablist" aria-label="Choose papers">
            {(
              [
                ["sample", t("tabSample"), <DocIcon key="i" size={16} />],
                ["text", t("tabPaste"), <DocIcon key="i" size={16} />],
                ["photo", t("tabPhoto"), <CameraIcon key="i" size={16} />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                className="tab"
                onClick={() => setTab(id)}
                hidden={id === "photo" && !props.canPhoto && !offline}
              >
                {icon}
                {label}
                {id !== "sample" && offline && <span className="tab-note">{t("needsAI")}</span>}
              </button>
            ))}
          </div>

          <div className="intake-body">
            {tab === "sample" && (
              <p className="intake-sample">
                <strong>Jordan Lee</strong> · Laparoscopic appendectomy · {t("sampleNote")}
              </p>
            )}
            {tab === "text" && (
              <textarea
                id="paste-text"
                className="paste"
                rows={6}
                value={text}
                placeholder={t("pastePlaceholder")}
                onChange={(e) => setText(e.target.value)}
              />
            )}
            {tab === "photo" && (
              <div className="photo-pick">
                <input
                  ref={fileRef}
                  id="photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  hidden
                />
                <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                  <CameraIcon size={18} /> {t("photoPick")}
                </button>
                {photoUrl ? (
                  <img className="photo-thumb" src={photoUrl} alt="" />
                ) : (
                  <span className="muted">{t("photoHint")}</span>
                )}
              </div>
            )}
            {needsAI && <p className="note warn">{t("errorNoAI")}</p>}
            {props.error && <p className="note warn">{props.error}</p>}
          </div>

          <div className="intake-foot">
            <button
              id="scan-button"
              className="btn btn-primary btn-big"
              disabled={!ready || needsAI}
              onClick={scan}
            >
              {t("scanButton")} <ArrowIcon size={20} />
            </button>
            <p className="fine">{t("safetyNote")}</p>
          </div>
        </div>
      </section>

      <section className="landing-paper" aria-label="Sample discharge papers">
        <div className="paper-stack">
          <Paper text={props.sampleText} sources={[]} className="paper-preview">
            <span className="stamp">SAMPLE</span>
          </Paper>
        </div>
      </section>
    </main>
  );
}
