import { NextRequest } from "next/server";
import { loadBank, saveBank } from "@/lib/experienceStore";

export const runtime = "nodejs";

export async function GET() {
  const bank = await loadBank();
  return Response.json(bank);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await saveBank(body);
    return Response.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid experience bank";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
