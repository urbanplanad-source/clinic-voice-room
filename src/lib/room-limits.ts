const DEFAULT_ACTIVE_ROOM_LIMIT = 3;
const DEFAULT_STALE_ROOM_MINUTES = 4 * 60;

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return value;
}

export function getHospitalActiveRoomLimit() {
  return positiveIntegerFromEnv("HOSPITAL_ACTIVE_ROOM_LIMIT", DEFAULT_ACTIVE_ROOM_LIMIT);
}

export function getStaleRoomMinutes() {
  return positiveIntegerFromEnv("ROOM_AUTO_END_MINUTES", DEFAULT_STALE_ROOM_MINUTES);
}

export function getStaleRoomCutoff(now = new Date()) {
  return new Date(now.getTime() - getStaleRoomMinutes() * 60 * 1000);
}
