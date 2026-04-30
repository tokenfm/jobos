import { anthropic } from "@/lib/anthropic";
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

interface Dimension {
  name: string;
  score: number;
  explanation: string;
}

interface AnalysisResult {
  score: number;
  dimensions: Dimension[];
  coverLetter: string;
  cvTips: { category: string; tip: string }[];
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
  "Aucun": 0,
  "Bac": 1,
  "Bac+2": 2,
  "Bac+3": 3,
  "Bac+4": 4,
  "Bac+5": 5,
  "Doctorat": 7,
};

function norm(s: string) {
  return s.toLowerCase().trim();
}

function matchSkills(cvSkills: string[], targets: string[]): string[] {
  return targets.filter((target) =>
    cvSkills.some((cvSkill) => {
      const t = norm(target);
      const c = norm(cvSkill);
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

  const reqRatio = job.requiredSkills.length > 0
    ? matched.length / job.requiredSkills.length
    : 1;
  const niceRatio = job.niceToHaveSkills.length > 0
    ? matchedNice.length / job.niceToHaveSkills.length
    : 0;

  return {
    score: Math.round(Math.min((reqRatio * 0.85 + niceRatio * 0.15) * 100, 100)),
    matched,
    missing,
  };
}

function scoreExperience(cv: CvExtract, job: JobOfferExtract): number {
  const required = job.minExperienceYears;
  if (required === null || required === 0) return 85;
  if (cv.totalExperienceYears >= required) {
    return Math.min(90 + Math.round(((cv.totalExperienceYears - required) / required) * 10), 100);
  }
  return Math.round(Math.max((cv.totalExperienceYears / required) * 80, 10));
}

function scoreDegree(cv: CvExtract, job: JobOfferExtract): number {
  const required = job.requiredDegree;
  if (!required || required === "Aucun") return 90;
  if (!cv.degree) return 40;
  const cvRank = DEGREE_RANK[cv.degree] ?? 3;
  const reqRank = DEGREE_RANK[required] ?? 3;
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
  const matchingWords = jobWords.filter(
    (w) => cvRoleNorm.includes(w) || cv.skills.some((s) => norm(s).includes(w))
  );
  if (jobWords.length > 0) {
    score += Math.round((matchingWords.length / jobWords.length) * 15);
  }

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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const cvFile = formData.get("cv") as File | null;
    const jobOffer = formData.get("jobOffer") as string | null;

    if (!cvFile || !jobOffer?.trim()) {
      return Response.json({ error: "CV et offre d'emploi requis." }, { status: 400 });
    }

    const cvBase64 = Buffer.from(await cvFile.arrayBuffer()).toString("base64");
    const pdfSource = {
      type: "base64" as const,
      media_type: "application/pdf" as const,
      data: cvBase64,
    };

    // ── Pass 1 : extraction structurée ───────────────────────────────────────
    const extractionMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
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
    "totalExperienceYears": <entier — total années d'expérience pro>,
    "degree": "<Bac|Bac+2|Bac+3|Bac+4|Bac+5|Doctorat|null>",
    "softSkills": ["<soft skill>"],
    "currentRole": "<dernier ou actuel poste>",
    "sector": "<secteur du candidat>"
  }
}`,
            },
          ],
        },
      ],
    });

    const extractionText =
      extractionMsg.content[0].type === "text" ? extractionMsg.content[0].text : "";
    const extraction: ExtractionResult = JSON.parse(extractionText);

    // ── Pass 2 : scoring côté code ────────────────────────────────────────────
    const { rawDimensions, total, skillResult } = calculateScores(extraction);

    // ── Pass 3 : génération lettre + explications + conseils ──────────────────
    const generationMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3072,
      messages: [
        {
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
- Expérience candidat : ${extraction.cv.totalExperienceYears} ans (requis : ${extraction.jobOffer.minExperienceYears ?? "non précisé"})
- Diplôme candidat : ${extraction.cv.degree ?? "non précisé"} (requis : ${extraction.jobOffer.requiredDegree ?? "non précisé"})

Génère les explications et contenus. Réponds UNIQUEMENT avec un JSON valide (sans markdown) :
{
  "explanations": {
    "Compétences techniques": "<1 phrase factuelle basée sur les compétences matchées/manquantes>",
    "Expérience": "<1 phrase factuelle basée sur les années>",
    "Formation": "<1 phrase factuelle basée sur le diplôme>",
    "Soft skills": "<1 phrase factuelle>",
    "Adéquation culturelle": "<1 phrase factuelle basée sur le secteur et le rôle>"
  },
  "coverLetter": "<lettre complète en français, formelle, qui met en valeur les compétences matchées et adresse les écarts>",
  "cvTips": [
    { "category": "<catégorie>", "tip": "<conseil concret basé sur les écarts identifiés>" }
  ]
}

Fournis au moins 5 conseils CV spécifiques à ce profil et cette offre.`,
            },
          ],
        },
      ],
    });

    const generationText =
      generationMsg.content[0].type === "text" ? generationMsg.content[0].text : "";
    const generated = JSON.parse(generationText);

    const dimensions: Dimension[] = rawDimensions.map((d) => ({
      ...d,
      explanation: generated.explanations[d.name] ?? "",
    }));

    const result: AnalysisResult = {
      score: total,
      dimensions,
      coverLetter: generated.coverLetter,
      cvTips: generated.cvTips,
    };

    return Response.json(result);
  } catch (error) {
    console.error("Analyze error:", error);
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Erreur lors de l'analyse par l'IA. Réessaie." },
        { status: 500 }
      );
    }
    return Response.json(
      { error: "Une erreur est survenue lors de l'analyse." },
      { status: 500 }
    );
  }
}
