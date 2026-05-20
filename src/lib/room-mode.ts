export const roomModes = ["consultation", "procedure"] as const;

export type RoomMode = (typeof roomModes)[number];

export function isRoomMode(value: unknown): value is RoomMode {
  return typeof value === "string" && roomModes.includes(value as RoomMode);
}
