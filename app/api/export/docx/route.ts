import { NextRequest } from "next/server";
import { ResumeSchema } from "@/lib/types";
import { resumeToDocx } from "@/lib/docx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const resume = ResumeSchema.parse(body.resume);
    const buffer = await resumeToDocx(resume);

    const safeName = resume.header.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Resume";
    const company = typeof body.company === "string" && body.company.trim()
      ? "_" + body.company.trim().replace(/[^A-Za-z0-9]+/g, "")
      : "";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}_Resume${company}.docx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
