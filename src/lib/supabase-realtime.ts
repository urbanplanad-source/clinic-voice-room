"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ParticipantRole, PatientLanguage } from "./languages";
import { isRoomStatus, type RoomStatus } from "./room-state";

type RealtimeRoom = {
  id: string;
  status: RoomStatus;
  patientLanguage?: PatientLanguage;
  patientJoinedAt?: string | null;
  endedAt?: string | null;
};

type RoomUpdatePayload = {
  room: RealtimeRoom;
};

export type RealtimeTranslationMessage = {
  id: string;
  speaker: ParticipantRole;
  sourceText?: string;
  text: string;
  targetLanguage?: PatientLanguage | "ko";
  createdAt?: string;
};

type TranslationMessagePayload = {
  message: RealtimeTranslationMessage;
};

let client: SupabaseClient | null = null;

function getRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || anonKey.includes("replace-me")) return null;
  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return client;
}

function toRealtimeRoom(room: { id: string; status: RoomStatus; patientLanguage?: PatientLanguage; patientJoinedAt?: string | Date | null; endedAt?: string | Date | null }) {
  return {
    id: room.id,
    status: room.status,
    patientLanguage: room.patientLanguage,
    patientJoinedAt: room.patientJoinedAt ? new Date(room.patientJoinedAt).toISOString() : null,
    endedAt: room.endedAt ? new Date(room.endedAt).toISOString() : null
  };
}

function parseRoomUpdate(value: unknown): RealtimeRoom | null {
  if (!value || typeof value !== "object" || !("room" in value)) return null;
  const room = (value as RoomUpdatePayload).room;
  if (!room || typeof room.id !== "string" || !isRoomStatus(room.status)) return null;
  return room;
}

function parseTranslationMessage(value: unknown): RealtimeTranslationMessage | null {
  if (!value || typeof value !== "object" || !("message" in value)) return null;
  const message = (value as TranslationMessagePayload).message;
  if (!message || typeof message.id !== "string" || typeof message.text !== "string") return null;
  if (message.speaker !== "staff" && message.speaker !== "patient") return null;
  if (message.sourceText !== undefined && typeof message.sourceText !== "string") return null;
  if (message.targetLanguage !== undefined && message.targetLanguage !== "ko" && typeof message.targetLanguage !== "string") return null;
  if (message.createdAt !== undefined && typeof message.createdAt !== "string") return null;
  return message;
}

export function subscribeToRoomUpdates(roomId: string, onRoomUpdate: (room: RealtimeRoom) => void) {
  const supabase = getRealtimeClient();
  if (!supabase) return null;

  const channel = supabase
    .channel(`clinic-room:${roomId}`)
    .on("broadcast", { event: "room:update" }, (payload) => {
      const room = parseRoomUpdate(payload.payload);
      if (room && room.id === roomId) onRoomUpdate(room);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToTranslationMessages(roomId: string, onMessage: (message: RealtimeTranslationMessage) => void) {
  const supabase = getRealtimeClient();
  if (!supabase) return null;

  const channel = supabase
    .channel(`clinic-room:${roomId}:translations`)
    .on("broadcast", { event: "translation:new" }, (payload) => {
      const message = parseTranslationMessage(payload.payload);
      if (message) onMessage(message);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function broadcastRoomUpdate(room: {
  id: string;
  status: RoomStatus;
  patientLanguage?: PatientLanguage;
  patientJoinedAt?: string | Date | null;
  endedAt?: string | Date | null;
}) {
  const supabase = getRealtimeClient();
  if (!supabase) return;

  const channel = supabase.channel(`clinic-room:${room.id}`);
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 1000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timer);
        resolve();
      }
    });
  });

  await channel.send({
    type: "broadcast",
    event: "room:update",
    payload: { room: toRealtimeRoom(room) }
  });
  await supabase.removeChannel(channel);
}

export async function broadcastTranslationMessage(roomId: string, message: RealtimeTranslationMessage) {
  const supabase = getRealtimeClient();
  if (!supabase) return false;

  const channel = supabase.channel(`clinic-room:${roomId}:translations`);
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 1000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timer);
        resolve();
      }
    });
  });

  try {
    const status = await channel.send({
      type: "broadcast",
      event: "translation:new",
      payload: { message }
    });
    return status === "ok";
  } catch {
    return false;
  } finally {
    await supabase.removeChannel(channel);
  }
}
