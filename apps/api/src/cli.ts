/**
 * Administration is command line, never an HTTP route. There is no endpoint that
 * creates a room: it would be the most attackable surface in the system, for
 * something used once a week.
 *
 *   pnpm room:create
 *   pnpm room:lock <token>
 *   pnpm room:close <token>
 *   pnpm room:list
 *   pnpm room:check    compares Redis against what LiveKit sees
 */
import { liveParticipants, liveRoomNames, revokeScreen } from "./livekit.ts";
import { connectRedis, redis } from "./redis.ts";
import {
  allStageLocks,
  closeRoom,
  createRoom,
  getRoom,
  listRooms,
  roomLink,
  saveRoom,
  stageLockHolder,
  timeLeft,
  tokenHint,
} from "./rooms.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function when(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR");
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  await connectRedis();

  switch (command) {
    case "create": {
      const room = await createRoom();
      console.log("");
      console.log("  Room created.");
      console.log("");
      console.log(`    ${roomLink(room.token)}`);
      console.log("");
      console.log(`  Expires ${when(room.expiresAt)}.`);
      console.log(`  Lock it:  pnpm room:lock ${room.token}`);
      console.log("");
      break;
    }

    case "lock": {
      if (!arg) fail("usage: room:lock <token>");
      const room = await getRoom(arg);
      if (!room) fail("room not found");
      room.locked = true;
      await saveRoom(room);
      console.log("Room locked. New arrivals refused.");
      break;
    }

    case "close": {
      if (!arg) fail("usage: room:close <token>");
      const room = await getRoom(arg);
      if (!room) fail("room not found");
      // Revoke before the room disappears, or somebody publishes into nothing.
      if (room.stage.status === "occupied") {
        await revokeScreen(room.livekitRoom, room.stage.userId);
      }
      await closeRoom(arg);
      console.log("Room closed.");
      break;
    }

    case "list": {
      const rooms = await listRooms();
      if (rooms.length === 0) {
        console.log("No active rooms.");
        break;
      }
      for (const room of rooms) {
        const stageLabel =
          room.stage.status === "occupied" ? `on air: ${room.stage.displayName}` : "screen free";
        console.log(
          `${room.token}  ${room.locked ? "locked" : "open  "}  ${stageLabel.padEnd(22)}  expires ${when(room.expiresAt)}`,
        );
      }
      break;
    }

    case "check": {
      const rooms = await listRooms();
      const onSfu = await liveRoomNames();
      const locks = await allStageLocks();
      let problems = 0;
      const warn = (msg: string) => {
        problems += 1;
        console.log(`    ! ${msg}`);
      };

      if (rooms.length === 0) console.log("No active rooms.");

      for (const room of rooms) {
        const people = await liveParticipants(room.livekitRoom);
        const remaining = timeLeft(room);
        const hours = Math.floor(remaining / 3600_000);
        const minutes = Math.floor((remaining % 3600_000) / 60_000);

        console.log(
          `
  ${room.token}  ${room.locked ? "locked" : "open"}  ` +
            `${people === null ? "no room on the SFU" : `${people.length} connected`}  ` +
            `expires in ${hours}h${String(minutes).padStart(2, "0")}`,
        );

        if (remaining <= 0) warn("expired, but still recorded in Redis");

        // Three sources that must agree: the record, the lock, and who connected.
        const lock = await stageLockHolder(room.token);
        if (room.stage.status === "occupied") {
          console.log(`    stage: ${room.stage.displayName}`);
          if (!lock) warn("stage occupied with no lock: the grant is not exclusive");
          else if (lock !== room.stage.userId) warn("the lock belongs to a different participant");
          if (people && !people.includes(room.stage.userId)) {
            warn("stage holder disconnected: waiting for the sweep");
          }
        } else if (lock) {
          warn(`orphaned lock (${lock}): the stage is blocked`);
        }
      }

      const orphanLocks = locks.filter((t) => !rooms.some((r) => r.token === t));
      for (const t of orphanLocks) warn(`lock ${tokenHint(t)}: no matching room`);

      const known = new Set(rooms.map((r) => r.livekitRoom));
      const leftover = onSfu.filter((n) => !known.has(n));
      for (const n of leftover) warn(`${n}: exists on the SFU, missing from Redis`);

      console.log("");
      console.log(
        problems === 0
          ? "  No inconsistencies."
          : `  ${problems} inconsistency(ies). Close a room with: pnpm room:close <token>`,
      );
      break;
    }

    default:
      fail("commands: create | lock <token> | close <token> | list | check");
  }

  await redis.close();
}

await main();
