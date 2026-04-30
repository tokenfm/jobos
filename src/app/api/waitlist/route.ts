import { Resend } from "resend";
import { NextRequest } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !EMAIL_RE.test(email)) {
      return Response.json({ error: "Email invalide." }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Ajoute le contact à l'audience Resend (si configurée)
    if (process.env.RESEND_AUDIENCE_ID) {
      await resend.contacts.create({
        email,
        audienceId: process.env.RESEND_AUDIENCE_ID,
      });
    }

    // Notifie le fondateur
    await resend.emails.send({
      from: "JobOS <onboarding@resend.dev>",
      to: ["gaspard692003@gmail.com"],
      subject: `🎉 Nouvelle inscription bêta — ${email}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Nouvelle inscription JobOS</h2>
          <p style="color:#666;margin:0 0 16px">Quelqu'un vient de rejoindre la liste d'attente.</p>
          <div style="background:#f4f4f5;border-radius:8px;padding:16px">
            <strong>${email}</strong>
          </div>
        </div>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return Response.json(
      { error: "Erreur lors de l'inscription. Réessaie." },
      { status: 500 }
    );
  }
}
