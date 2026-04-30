import { anthropic } from "@/lib/anthropic";
import { ratelimit } from "@/lib/ratelimit";
import { NextRequest } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobOfferExtract {
  title: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minExperienceYears: number | null;
  requiredDegree: string | null;
  requiredSoftSkills: string[];
  sector: string;
}

interface CvExtract {
  skills: string[];
  totalExperienceYears: number;
  degree: string | null;
  softSkills: string[];
  currentRole: string;
  sector: string;
}

interface ExtractionResult {
  jobOffer: JobOfferExtract;
  cv: CvExtract;
}

// ─── Scoring (déterministe, côté code) ───────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  "Compétences techniques": 0.35,
  "Expérience": 0.30,
  "Formation": 0.15,
  "Soft skills": 0.10,
  "Adéquation culturelle": 0.10,
};

const DEGREE_RANK: Record<string, number> = {
  "Aucun": 0, "Bac": 1, "Bac+2": 2, "Bac+3": 3,
  "Bac+4": 4, "Bac+5": 5, "Doctorat": 7,
};

function norm(s: string) { return s.toLowerCase().trim(); }

function matchSkills(cvSkills: string[], targets: string[]): string[] {
  return targets.filter((target) =>
    cvSkills.some((s) => {
      const t = norm(target), c = norm(s);
      return c === t || c.includes(t) || t.includes(c);
    })
  );
}

function scoreSkills(cv: CvExtract, job: JobOfferExtract) {
  const matched = matchSkills(cv.skills, job.requiredSkills);
  const matchedNice = matchSkills(cv.skills, job.niceToHaveSkills);
  const missing = job.requiredSkills.filter(
    (s) => !matched.some((m) => norm(m) === norm(s))
  );
  const reqRatio = job.requiredSkills.length > 0 ? matched.length / job.requiredSkills.length : 1;
  const niceRatio = job.niceToHaveSkills.length > 0 ? matchedNice.length / job.niceToHaveSkills.length : 0;
  return {
    score: Math.round(Math.min((reqRatio * 0.85 + niceRatio * 0.15) * 100, 100)),
    matched,
    missing,
  };
}

function scoreExperience(cv: CvExtract, job: JobOfferExtract): number {
  const req = job.minExperienceYears;
  if (req === null || req === 0) return 85;
  if (cv.totalExperienceYears >= req)
    return Math.min(90 + Math.round(((cv.totalExperienceYears - req) / req) * 10), 100);
  return Math.round(Math.max((cv.totalExperienceYears / req) * 80, 10));
}

function scoreDegree(cv: CvExtract, job: JobOfferExtract): number {
  if (!job.requiredDegree || job.requiredDegree === "Aucun") return 90;
  if (!cv.degree) return 40;
  const cvRank = DEGREE_RANK[cv.degree] ?? 3;
  const reqRank = DEGREE_RANK[job.requiredDegree] ?? 3;
  if (cvRank >= reqRank) return 100;
  const diff = reqRank - cvRank;
  if (diff === 1) return 70;
  if (diff === 2) return 45;
  return 25;
}

function scoreSoftSkills(cv: CvExtract, job: JobOfferExtract): number {
  if (job.requiredSoftSkills.length === 0) return 80;
  const matched = matchSkills(cv.softSkills, job.requiredSoftSkills);
  return Math.round(Math.min((matched.length / job.requiredSoftSkills.length) * 100, 100));
}

function scoreCulturalFit(cv: CvExtract, job: JobOfferExtract): number {
  let score = 50;
  const cvSector = norm(cv.sector ?? "");
  const jobSector = norm(job.sector ?? "");
  if (cvSector && jobSector) {
    if (cvSector === jobSector) score += 25;
    else if (cvSector.includes(jobSector) || jobSector.includes(cvSector)) score += 15;
  }
  const jobWords = norm(job.title ?? "").split(/\s+/).filter((w) => w.length > 3);
  const cvRoleNorm = norm(cv.currentRole ?? "");
  const hits = jobWords.filter(
    (w) => cvRoleNorm.includes(w) || cv.skills.some((s) => norm(s).includes(w))
  );
  if (jobWords.length > 0) score += Math.round((hits.length / jobWords.length) * 15);
  return Math.min(score, 100);
}

function calculateScores(data: ExtractionResult) {
  const skillResult = scoreSkills(data.cv, data.jobOffer);
  const rawDimensions = [
    { name: "Compétences techniques", score: skillResult.score },
    { name: "Expérience", score: scoreExperience(data.cv, data.jobOffer) },
    { name: "Formation", score: scoreDegree(data.cv, data.jobOffer) },
    { name: "Soft skills", score: scoreSoftSkills(data.cv, data.jobOffer) },
    { name: "Adéquation culturelle", score: scoreCulturalFit(data.cv, data.jobOffer) },
  ];
  const total = Math.round(
    rawDimensions.reduce((sum, d) => sum + d.score * (WEIGHTS[d.name] ?? 0), 0)
  );
  return { rawDimensions, total, skillResult };
}

// ─── Route (streaming SSE) ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (ratelimit) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const { success, remaining } = await ratelimit.limit(ip);
    if (!success) {
      return Response.json(
        { error: `Limite atteinte. Tu as utilisé tes 5 analyses gratuites aujourd'hui. Réessaie demain.` },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": String(remaining) },
        }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const formData = await request.formData();
        const cvFile = formData.get("cv") as File | null;
        const jobOffer = formData.get("jobOffer") as string | null;

        if (!cvFile || !jobOffer?.trim()) {
          send({ type: "error", message: "CV et offre d'emploi requis." });
          return;
        }

        const cvBase64 = Buffer.from(await cvFile.arrayBuffer()).toString("base64");
        const pdfSource = {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: cvBase64,
        };

        // ── Pass 1 : extraction ─────────────────────────────────────────────
        send({ type: "status", message: "Analyse de ton CV…" });

        const extractionMsg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: pdfSource },
              {
                type: "text",
                text: `Extrait les informations structurées du CV ci-joint et de cette offre.

OFFRE D'EMPLOI :
${jobOffer}

Réponds UNIQUEMENT avec un JSON valide (sans markdown) :
{
  "jobOffer": {
    "title": "<intitulé du poste>",
    "requiredSkills": ["<compétence technique obligatoire>"],
    "niceToHaveSkills": ["<compétence appréciée>"],
    "minExperienceYears": <entier ou null>,
    "requiredDegree": "<Bac|Bac+2|Bac+3|Bac+4|Bac+5|Doctorat|Aucun|null>",
    "requiredSoftSkills": ["<soft skill>"],
    "sector": "<secteur d'activité>"
  },
  "cv": {
    "skills": ["<compétence technique>"],
    "totalExperienceYears": <entier>,
    "degree": "<Bac|Bac+2|Bac+3|Bac+4|Bac+5|Doctorat|null>",
    "softSkills": ["<soft skill>"],
    "currentRole": "<dernier ou actuel poste>",
    "sector": "<secteur du candidat>"
  }
}`,
              },
            ],
          }],
        });

        const extractionText =
          extractionMsg.content[0].type === "text" ? extractionMsg.content[0].text : "";
        const extraction: ExtractionResult = JSON.parse(extractionText);

        // ── Pass 2 : scoring côté code ──────────────────────────────────────
        send({ type: "status", message: "Calcul du score…" });

        const { rawDimensions, total, skillResult } = calculateScores(extraction);
        send({ type: "score", score: total, dimensions: rawDimensions });

        // ── Pass 3 : génération en streaming ───────────────────────────────
        send({ type: "status", message: "Rédaction de ta lettre…" });

        const generationStream = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 3072,
          stream: true,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: pdfSource },
              {
                type: "text",
                text: `Tu es un expert en recrutement en France.

OFFRE D'EMPLOI :
${jobOffer}

ANALYSE CALCULÉE :
- Score global : ${total}/100
${rawDimensions.map((d) => `- ${d.name} : ${d.score}/100`).join("\n")}
- Compétences matchées : ${skillResult.matched.join(", ") || "aucune"}
- Compétences manquantes : ${skillResult.missing.join(", ") || "aucune"}
- Expérience : ${extraction.cv.totalExperienceYears} ans (requis : ${extraction.jobOffer.minExperienceYears ?? "non précisé"})
- Diplôme : ${extraction.cv.degree ?? "non précisé"} (requis : ${extraction.jobOffer.requiredDegree ?? "non précisé"})

Génère dans CET ORDRE EXACT, sans dévier du format :

1. La lettre de motivation entre ces balises exactes :
<lettre>
[lettre complète en français, formelle, personnalisée, qui met en valeur les compétences matchées et adresse les écarts]
</lettre>

2. Immédiatement après (sans saut de ligne), ce JSON valide (sans markdown) :
{"explanations":{"Compétences techniques":"<1 phrase factuelle>","Expérience":"<1 phrase factuelle>","Formation":"<1 phrase factuelle>","Soft skills":"<1 phrase factuelle>","Adéquation culturelle":"<1 phrase factuelle>"},"cvTips":[{"category":"<catégorie>","tip":"<conseil concret et actionnable>"}]}

Fournis au moins 5 cvTips spécifiques à ce profil.`,
              },
            ],
          }],
        });

        let fullText = "";
        let letterStartIdx = -1;
        let letterEndIdx = -1;
        let letterSentUntil = 0;
        const CLOSE_TAG = "</lettre>";

        for await (const event of generationStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;

            // Detect opening tag
            if (letterStartIdx === -1) {
              const idx = fullText.indexOf("<lettre>");
              if (idx !== -1) {
                letterStartIdx = idx + 8;
                letterSentUntil = letterStartIdx;
              }
            }

            // Stream letter chunks
            if (letterStartIdx !== -1 && letterEndIdx === -1) {
              const endIdx = fullText.indexOf(CLOSE_TAG);
              if (endIdx !== -1) {
                letterEndIdx = endIdx;
                const remaining = fullText.slice(letterSentUntil, letterEndIdx);
                if (remaining) send({ type: "letter_chunk", text: remaining });
                send({ type: "letter_done" });
              } else {
                // Leave a buffer in case the closing tag spans chunks
                const safeTo = fullText.length - CLOSE_TAG.length;
                if (safeTo > letterSentUntil) {
                  send({ type: "letter_chunk", text: fullText.slice(letterSentUntil, safeTo) });
                  letterSentUntil = safeTo;
                }
              }
            }
          }
        }

        // Parse JSON part after </lettre>
        if (letterEndIdx === -1) {
          send({ type: "error", message: "Format de réponse inattendu. Réessaie." });
          return;
        }

        const jsonPart = fullText.slice(letterEndIdx + CLOSE_TAG.length).trim();
        const generated = JSON.parse(jsonPart);

        const dimensions = rawDimensions.map((d) => ({
          ...d,
          explanation: generated.explanations?.[d.name] ?? "",
        }));

        send({ type: "details", dimensions, cvTips: generated.cvTips });
        send({ type: "done" });
      } catch (error) {
        console.error("Analyze error:", error);
        send({ type: "error", message: "Une erreur est survenue lors de l'analyse." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
