export const staffRoomSelect = {
  id: true,
  patientLanguage: true,
  roomMode: true,
  patientJoinCode: true,
  status: true,
  createdAt: true,
  lastActiveAt: true,
  patientJoinedAt: true,
  endedAt: true,
  hospital: {
    select: { name: true }
  },
  usageSession: {
    select: {
      totalRoomSeconds: true,
      roomStartedAt: true,
      roomEndedAt: true
    }
  }
} as const;
