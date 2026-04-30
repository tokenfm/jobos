"use client";

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dimension {
  name: string;
  score: number;
  explanation: string;
}

interface CvTip {
  category: string;
  tip: string;
}

type Phase = "form" | "loading" | "results";

// ─── Shared components ────────────────────────────────────────────────────────

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 6.8 17.2 12 22 12C17.2 12 12 17.2 12 22C12 17.2 6.8 12 2 12C6.8 12 12 6.8 12 2Z" />
    </svg>
  );
}

function CircularScore({ score }: { score: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#8b5cf6" : score >= 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
      <svg width="148" height="148" viewBox="0 0 148 148" className="-rotate-90">
        <circle cx="74" cy="74" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle
          cx="74" cy="74" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="block text-xs text-zinc-500 mt-0.5">/100</span>
      </div>
    </div>
  );
}

function scoreColor(s: number) {
  return s >= 75 ? "text-emerald-400" : s >= 50 ? "text-violet-400" : s >= 25 ? "text-amber-400" : "text-red-400";
}
function barColor(s: number) {
  return s >= 75 ? "bg-emerald-500" : s >= 50 ? "bg-violet-500" : s >= 25 ? "bg-amber-500" : "bg-red-500";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobOffer, setJobOffer] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  // Streaming state
  const [phase, setPhase] = useState<Phase>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [streamedLetter, setStreamedLetter] = useState("");
  const [letterDone, setLetterDone] = useState(false);
  const [cvTips, setCvTips] = useState<CvTip[]>([]);
  const [copied, setCopied] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") { setCvFile(file); setError(""); }
    else setError("Veuillez uploader un fichier PDF.");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCvFile(file); setError(""); }
  };

  const handleReset = () => {
    setPhase("form");
    setScore(null);
    setDimensions([]);
    setStreamedLetter("");
    setLetterDone(false);
    setCvTips([]);
    setStatusMsg("");
    setError("");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(streamedLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvFile || !jobOffer.trim()) {
      setError("Veuillez fournir votre CV et l'offre d'emploi.");
      return;
    }

    setPhase("loading");
    setStatusMsg("Analyse de ton CV…");
    setScore(null);
    setDimensions([]);
    setStreamedLetter("");
    setLetterDone(false);
    setCvTips([]);
    setError("");

    const formData = new FormData();
    formData.append("cv", cvFile);
    formData.append("jobOffer", jobOffer);

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: formData });

      if (!response.ok && response.status !== 200) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Une erreur est survenue.");
      }

      if (!response.body) throw new Error("Pas de réponse du serveur.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          switch (event.type) {
            case "status":
              setStatusMsg(event.message);
              break;
            case "score":
              setScore(event.score);
              setDimensions(event.dimensions.map((d: Omit<Dimension, "explanation">) => ({ ...d, explanation: "" })));
              setPhase("results");
              break;
            case "letter_chunk":
              setStreamedLetter((prev) => prev + event.text);
              break;
            case "letter_done":
              setLetterDone(true);
              break;
            case "details":
              setDimensions(event.dimensions);
              setCvTips(event.cvTips);
              break;
            case "error":
              setError(event.message);
              setPhase("form");
              break;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPhase("form");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0714] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] backdrop-blur-md bg-[#0a0714]/80">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkle className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">JobOS</span>
          </div>
          <span className="hidden sm:block text-xs text-zinc-600">Copilote de candidature IA</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">

        {/* ── Form ── */}
        {phase === "form" && (
          <>
            <div className="mb-12 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-3 py-1 text-xs text-violet-400 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                Propulsé par Claude
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
                Optimise ta candidature
                <br />
                <span className="text-violet-400">en quelques secondes</span>
              </h1>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Upload ton CV, colle l&apos;offre d&apos;emploi et obtiens un score de compatibilité,
                une lettre personnalisée et des conseils actionnables.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Ton CV <span className="font-normal text-zinc-500">(PDF)</span>
                  </label>
                  <div
                    onDragEnter={handleDrag} onDragLeave={handleDrag}
                    onDragOver={handleDrag} onDrop={handleDrop}
                    onClick={() => document.getElementById("cv-upload")?.click()}
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all cursor-pointer select-none ${
                      dragActive ? "border-violet-400 bg-violet-500/8"
                      : cvFile ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400/60"
                      : "border-zinc-700/60 bg-zinc-900/20 hover:border-zinc-600 hover:bg-zinc-900/40"
                    }`}
                  >
                    <input id="cv-upload" type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                    {cvFile ? (
                      <>
                        <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
                          <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-emerald-400 text-center truncate max-w-[200px]">{cvFile.name}</p>
                        <p className="text-xs text-zinc-500 mt-1">Clique pour changer</p>
                      </>
                    ) : (
                      <>
                        <div className="h-12 w-12 rounded-full bg-zinc-800/80 flex items-center justify-center mb-3">
                          <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-zinc-300">Glisse ton CV ici</p>
                        <p className="text-xs text-zinc-500 mt-1">ou clique pour parcourir — PDF uniquement</p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="job-offer" className="block text-sm font-medium text-zinc-300 mb-2">
                    Offre d&apos;emploi
                  </label>
                  <textarea
                    id="job-offer" value={jobOffer} onChange={(e) => setJobOffer(e.target.value)}
                    placeholder="Colle ici le texte de l'offre d'emploi…" rows={11}
                    className="w-full rounded-2xl border-2 border-zinc-700/60 bg-zinc-900/20 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-violet-500/60 focus:outline-none resize-none transition-colors hover:border-zinc-600"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">{error}</div>
              )}

              <button
                type="submit" disabled={!cvFile || !jobOffer.trim()}
                className="w-full rounded-2xl bg-violet-600 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 transition-all hover:bg-violet-500 hover:shadow-violet-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Analyser ma candidature →
              </button>
            </form>
          </>
        )}

        {/* ── Loading (passes 1 & 2) ── */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
            <div className="h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Sparkle className="h-7 w-7 text-violet-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">{statusMsg}</p>
              <p className="text-xs text-zinc-600 mt-1">{cvFile?.name}</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Results (progressive) ── */}
        {phase === "results" && (
          <div className="space-y-6">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Nouvelle analyse
            </button>

            {/* Score */}
            {score !== null && (
              <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-8">
                  Score de compatibilité
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-10">
                  <div className="shrink-0"><CircularScore score={score} /></div>
                  <div className="flex-1 w-full space-y-4">
                    {dimensions.map((dim) => (
                      <div key={dim.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-zinc-300">{dim.name}</span>
                          <span className={`text-sm font-semibold tabular-nums ${scoreColor(dim.score)}`}>
                            {dim.score}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div
                            className={`h-1.5 rounded-full ${barColor(dim.score)}`}
                            style={{ width: `${dim.score}%`, transition: "width 0.8s ease" }}
                          />
                        </div>
                        {dim.explanation && (
                          <p className="mt-1 text-xs text-zinc-600">{dim.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Cover letter — streams in */}
            {score !== null && (
              <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-8">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Lettre de motivation
                  </p>
                  {letterDone && (
                    <button
                      onClick={handleCopy}
                      className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
                        copied ? "text-emerald-400" : "text-violet-400 hover:text-violet-300"
                      }`}
                    >
                      {copied ? (
                        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copié !</>
                      ) : (
                        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copier</>
                      )}
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap rounded-xl border border-white/[0.05] bg-zinc-950/60 p-6 text-sm leading-relaxed text-zinc-300 min-h-[80px]">
                  {streamedLetter}
                  {!letterDone && (
                    <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </section>
            )}

            {/* CV Tips — appear when details arrive */}
            {cvTips.length > 0 ? (
              <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">
                  Conseils pour ton CV
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cvTips.map((tip, i) => (
                    <div key={i} className="flex gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-4">
                      <div className="h-7 w-7 shrink-0 rounded-lg bg-violet-500/15 flex items-center justify-center">
                        <span className="text-xs font-bold text-violet-400">{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200 mb-0.5">{tip.category}</p>
                        <p className="text-xs leading-relaxed text-zinc-500">{tip.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : letterDone && (
              // Skeleton while tips load
              <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">
                  Conseils pour ton CV
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-4 animate-pulse">
                      <div className="h-7 w-7 shrink-0 rounded-lg bg-zinc-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 rounded bg-zinc-800 w-1/2" />
                        <div className="h-2 rounded bg-zinc-800/70 w-full" />
                        <div className="h-2 rounded bg-zinc-800/50 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
