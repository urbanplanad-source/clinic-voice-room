export function legacyRoomTokenAccessEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_LEGACY_ROOM_TOKEN_LOOKUP === "true";
}
