import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getParticipants, summarizeRoom, upsertParticipant } from "../../../../lib/store";

export const runtime = "nodejs";

const BodySchema = z.object({
  participantId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(80).default("Friend"),
  mediaTimeSeconds: z.number().finite().nonnegative(),
  wallTimeMs: z.number().int().positive(),
  paused: z.boolean(),
  playbackRate: z.number().finite().positive().max(16).default(1),
  manualOffsetSeconds: z.number().finite().min(-600).max(600).default(0),
  href: z.string().url().optional(),
  markEpochMs: z.number().int().positive().nullable().optional()
});

type Params = { params: Promise<{ roomId: string }> };

function cors(response: NextResponse) {
  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  response.headers.set("access-control-allow-headers", "content-type");
  return response;
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const participants = await getParticipants(roomId);
  return cors(NextResponse.json(summarizeRoom(participants)));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const json = await request.json();
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return cors(NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 }));
  }

  await upsertParticipant(roomId, {
    ...parsed.data,
    updatedAtMs: Date.now()
  });

  const participants = await getParticipants(roomId);
  return cors(NextResponse.json(summarizeRoom(participants)));
}
