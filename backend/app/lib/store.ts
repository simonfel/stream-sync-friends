import { Redis } from "@upstash/redis";

export type ParticipantState = {
  participantId: string;
  displayName: string;
  mediaTimeSeconds: number;
  wallTimeMs: number;
  paused: boolean;
  playbackRate: number;
  manualOffsetSeconds: number;
  href?: string;
  markEpochMs?: number | null;
  updatedAtMs: number;
};

const ROOM_TTL_SECONDS = 60 * 60 * 6;
const PARTICIPANT_STALE_MS = 15_000;
const memoryRooms = new Map<string, Record<string, ParticipantState>>();

function redis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
}

function roomKey(roomId: string) {
  return `ssf:room:${roomId}`;
}

export async function upsertParticipant(roomId: string, state: ParticipantState) {
  const client = redis();
  if (client) {
    await client.hset(roomKey(roomId), { [state.participantId]: JSON.stringify(state) });
    await client.expire(roomKey(roomId), ROOM_TTL_SECONDS);
    return;
  }

  const room = memoryRooms.get(roomId) ?? {};
  room[state.participantId] = state;
  memoryRooms.set(roomId, room);
}

export async function getParticipants(roomId: string) {
  const client = redis();
  const now = Date.now();
  let room: Record<string, string | ParticipantState> = {};

  if (client) {
    room = await client.hgetall<Record<string, string>>(roomKey(roomId)) ?? {};
  } else {
    room = memoryRooms.get(roomId) ?? {};
  }

  const participants = Object.values(room)
    .map((value) => typeof value === "string" ? JSON.parse(value) as ParticipantState : value)
    .filter((participant) => now - participant.updatedAtMs < PARTICIPANT_STALE_MS);

  if (!client) {
    memoryRooms.set(roomId, Object.fromEntries(participants.map((p) => [p.participantId, p])));
  }

  return participants;
}

export function estimatedMediaTime(participant: ParticipantState, nowMs = Date.now()) {
  if (participant.paused) return participant.mediaTimeSeconds;
  const elapsedSeconds = Math.max(0, (nowMs - participant.wallTimeMs) / 1000);
  return participant.mediaTimeSeconds + elapsedSeconds * (participant.playbackRate || 1);
}

export function summarizeRoom(participants: ParticipantState[]) {
  const now = Date.now();
  const estimates = participants.map((participant) => ({
    participantId: participant.participantId,
    displayName: participant.displayName,
    estimatedMediaTimeSeconds: estimatedMediaTime(participant, now),
    updatedAtMs: participant.updatedAtMs,
    paused: participant.paused
  }));

  const slowest = estimates.reduce<typeof estimates[number] | null>((min, item) => {
    if (!min || item.estimatedMediaTimeSeconds < min.estimatedMediaTimeSeconds) return item;
    return min;
  }, null);

  const targetMediaTimeSeconds = slowest?.estimatedMediaTimeSeconds ?? null;

  return {
    now,
    mode: redis() ? "redis" : "memory",
    targetMediaTimeSeconds,
    slowestParticipantId: slowest?.participantId ?? null,
    participants: estimates
  };
}
