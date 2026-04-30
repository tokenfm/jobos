"use client";

import { useState } from "react";

const features = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Score de compatibilité",
    description: "Analyse instantanée de ton CV face à l'offre. Compétences, expérience, formation — tu sais exactement où tu en es avant d'envoyer.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    title: "Lettre personnalisée",
    description: "Une lettre de motivation rédigée en français, calibrée sur ton profil et l'offre. Prête à envoyer, pas générique.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    title: "Coach entretien",
    description: "Prépare tes entretiens avec des questions ciblées basées sur le poste. Réponds, reçois un feedback, progresse.",
  },
];

const steps = [
  { number: "01", label: "Upload ton CV en PDF" },
  { number: "02", label: "Colle l'offre d'emploi" },
  { number: "03", label: "Reçois ton analyse complète" },
];

export default function Landing() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#070c16] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/25">
            J
          </div>
          <span className="text-lg font-semibold tracking-tight">JobOS</span>
        </div>
        <a
          href="/"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Essayer l&apos;app →
        </a>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-3 py-1 text-xs text-blue-400 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Bêta privée — places limitées
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Le copilote IA de ta{" "}
          <span className="text-blue-400">recherche d&apos;emploi</span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-12 leading-relaxed">
          Score de fit, lettre de motivation personnalisée et coach entretien en
          français &mdash; conçu pour les étudiants européens.
        </p>

        {/* Email form */}
        {submitted ? (
          <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-6 py-4 text-emerald-400">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">
              Tu es sur la liste ! On te contacte dès l&apos;ouverture.
            </span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="w-full rounded-xl border-2 border-zinc-700/60 bg-zinc-900/40 px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:border-blue-500/60 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto shrink-0 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 transition-all hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Envoi…
                </span>
              ) : (
                "Rejoindre la bêta"
              )}
            </button>
          </form>
        )}

        <p className="mt-4 text-xs text-zinc-600">
          Gratuit pendant la bêta · Aucune carte bancaire requise
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-white/[0.06] bg-white/[0.02] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-10">
            Comment ça marche
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-center gap-4 sm:flex-col sm:text-center sm:gap-3">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-400">{step.number}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute" />
                )}
                <p className="text-sm font-medium text-zinc-300">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Fonctionnalités
        </p>
        <h2 className="text-center text-3xl font-bold tracking-tight mb-12">
          Tout ce qu&apos;il te faut pour décrocher le poste
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-6 hover:border-blue-500/20 hover:bg-zinc-900/60 transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center text-blue-400 mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Prêt à booster tes candidatures ?
          </h2>
          <p className="text-zinc-500 mb-8 text-sm">
            Rejoins les premiers utilisateurs et accède à JobOS gratuitement pendant la bêta.
          </p>
          {submitted ? (
            <div className="inline-flex items-center gap-2 text-sm text-emerald-400 font-medium">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Tu es sur la liste !
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row items-center gap-3 max-w-sm mx-auto"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="w-full rounded-xl border-2 border-zinc-700/60 bg-zinc-950/60 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-blue-500/60 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
              >
                Rejoindre la bêta
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto max-w-5xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-xs">
              J
            </div>
            <span className="text-sm font-medium text-zinc-400">JobOS</span>
          </div>
          <p className="text-xs text-zinc-600">
            Conçu pour les étudiants européens
          </p>
        </div>
      </footer>
    </div>
  );
}
