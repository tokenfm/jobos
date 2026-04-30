import { anthropic } from "@/lib/anthropic";
import { NextRequest } from "next/server";

interface Dimension {
  name: string;
  score: number;
  explanation: string;
}

interface CvTip {
  category: string;
  tip: string;
}

interface AnalysisResult {
  score: number;
  dimensions: Dimension[];
  coverLetter: string;
  cvTips: CvTip[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const cvFile = formData.get("cv") as File | null;
    const jobOffer = formData.get("jobOffer") as string | null;

    if (!cvFile || !jobOffer?.trim()) {
      return Response.json(
        { error: "CV et offre d'emploi requis." },
        { status: 400 }
      );
    }

    const cvBuffer = await cvFile.arrayBuffer();
    const cvBase64 = Buffer.from(cvBuffer).toString("base64");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: cvBase64,
              },
            },
            {
              type: "text",
              text: `Tu es un expert en recrutement et rédaction professionnelle en France. Analyse le CV ci-joint et l'offre d'emploi suivante.

OFFRE D'EMPLOI :
${jobOffer}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks) :
{
  "score": <number 0-100>,
  "dimensions": [
    { "name": "Compétences techniques", "score": <number 0-100>, "explanation": "<explication courte>" },
    { "name": "Expérience", "score": <number 0-100>, "explanation": "<explication courte>" },
    { "name": "Formation", "score": <number 0-100>, "explanation": "<explication courte>" },
    { "name": "Soft skills", "score": <number 0-100>, "explanation": "<explication courte>" },
    { "name": "Adéquation culturelle", "score": <number 0-100>, "explanation": "<explication courte>" }
  ],
  "coverLetter": "<lettre de motivation complète en français, formelle, personnalisée, prête à envoyer>",
  "cvTips": [
    { "category": "<catégorie>", "tip": "<conseil concret et actionnable pour adapter ce CV à cette offre>" }
  ]
}

Règles :
- Le score global est la moyenne pondérée des dimensions (compétences techniques × 0.35, expérience × 0.30, formation × 0.15, soft skills × 0.10, adéquation × 0.10).
- La lettre doit faire référence à des éléments spécifiques du CV et de l'offre.
- Fournis au moins 5 conseils CV distincts et actionnables.`,
            },
          ],
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const analysis: AnalysisResult = JSON.parse(responseText);

    return Response.json(analysis);
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
