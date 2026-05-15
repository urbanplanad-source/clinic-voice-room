import type { ParticipantRole } from "./languages";

export const roomStatuses = [
  "waiting_for_patient",
  "ready",
  "staff_speaking",
  "translating_to_patient",
  "patient_listening",
  "patient_speaking",
  "translating_to_staff",
  "staff_listening",
  "ended",
  "error"
] as const;

export type RoomStatus = (typeof roomStatuses)[number];

const allowedTransitions: Record<RoomStatus, RoomStatus[]> = {
  waiting_for_patient: ["ready", "ended", "error"],
  ready: ["staff_speaking", "patient_speaking", "ended", "error"],
  staff_speaking: ["ready", "translating_to_patient", "ended", "error"],
  translating_to_patient: ["patient_listening", "ready", "ended", "error"],
  patient_listening: ["ready", "ended", "error"],
  patient_speaking: ["ready", "translating_to_staff", "ended", "error"],
  translating_to_staff: ["staff_listening", "ready", "ended", "error"],
  staff_listening: ["ready", "ended", "error"],
  ended: [],
  error: ["ready", "ended"]
};

export function isRoomStatus(value: unknown): value is RoomStatus {
  return typeof value === "string" && roomStatuses.includes(value as RoomStatus);
}

export function canTransition(from: RoomStatus, to: RoomStatus) {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function canRoleRequestStatus(role: ParticipantRole, status: RoomStatus) {
  if (status === "ended") return role === "staff";
  if (status === "staff_speaking" || status === "translating_to_patient") return role === "staff";
  if (status === "patient_speaking" || status === "translating_to_staff") return role === "patient";
  return true;
}

export function isMicEnabled(status: RoomStatus, role: ParticipantRole) {
  if (status !== "ready") return false;
  return role === "staff" || role === "patient";
}
