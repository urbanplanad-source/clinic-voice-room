import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getStaleRoomCutoff } from "./room-limits";

type EndStaleRoomsOptions = {
  now?: Date;
  hospitalId?: string;
};

type EndedRoomRow = {
  id: string;
};

export async function endStaleRooms(options: EndStaleRoomsOptions = {}) {
  const now = options.now ?? new Date();
  const cutoff = getStaleRoomCutoff(now);
  const hospitalFilter = options.hospitalId ? Prisma.sql`AND "hospitalId" = ${options.hospitalId}` : Prisma.empty;

  const endedRooms = await prisma.$queryRaw<EndedRoomRow[]>(Prisma.sql`
    UPDATE "TranslationRoom"
    SET "status" = 'ended'::"RoomStatus",
        "endedAt" = ${now}
    WHERE "status" <> 'ended'::"RoomStatus"
      AND "createdAt" < ${cutoff}
      ${hospitalFilter}
    RETURNING "id"
  `);

  if (!endedRooms.length) {
    return { endedCount: 0, cutoff };
  }

  const roomIds = endedRooms.map((room) => room.id);
  await prisma.consultationMessage.deleteMany({
    where: { roomId: { in: roomIds } }
  });

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "UsageSession" AS usage
    SET "roomEndedAt" = COALESCE(usage."roomEndedAt", rooms."endedAt"),
        "totalRoomSeconds" = GREATEST(
          usage."totalRoomSeconds",
          EXTRACT(EPOCH FROM (rooms."endedAt" - usage."roomStartedAt"))::integer
        )
    FROM "TranslationRoom" AS rooms
    WHERE usage."roomId" = rooms."id"
      AND rooms."id" IN (${Prisma.join(roomIds)})
  `);

  return { endedCount: endedRooms.length, cutoff };
}
