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
  const supabase = getServerRealtimeClient();
  if (!supabase) return false;

  const channel = supabase.channel(`clinic-room:${roomId}:translations`);
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timer);
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
    await supabase.removeChannel(channel);
    return status === "ok";
  } catch {
    await supabase.removeChannel(channel);
    return false;
  }
}
