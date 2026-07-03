import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeTranslationMessage } from "./supabase-realtime";

let serverClient: SupabaseClient | null = null;

function getServerRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || anonKey.includes("replace-me")) return null;

  serverClient ??= createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return serverClient;
}

export async function broadcastServerTranslationMessage(roomId: string, message: RealtimeTranslationMessage) {
  const startedAt = Date.now();
  const supabase = getServerRealtimeClient();
  if (!supabase) {
    console.log("[supabase-realtime-server] translation broadcast skipped", JSON.stringify({ roomId, reason: "disabled" }));
    return false;
  }

  const channel = supabase.channel(`clinic-room:${roomId}:translations`);
  let subscribed = false;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        subscribed = status === "SUBSCRIBED";
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const joinMs = Date.now() - startedAt;

  try {
    const sendStartedAt = Date.now();
    const status = await channel.send({
      type: "broadcast",
      event: "translation:new",
      payload: { message }
    });
    const sendMs = Date.now() - sendStartedAt;
    await supabase.removeChannel(channel);
    console.log(
      "[supabase-realtime-server] translation broadcast",
      JSON.stringify({ roomId, messageId: message.id, subscribed, status, joinMs, sendMs, totalMs: Date.now() - startedAt })
    );
    return status === "ok";
  } catch (caught) {
    await supabase.removeChannel(channel);
    console.error(
      "[supabase-realtime-server] translation broadcast failed",
      JSON.stringify({
        roomId,
        messageId: message.id,
        subscribed,
        joinMs,
        totalMs: Date.now() - startedAt,
        error: caught instanceof Error ? caught.message : "unknown"
      })
    );
    return false;
  }
}
