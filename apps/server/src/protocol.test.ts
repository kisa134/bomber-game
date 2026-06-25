import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeRoomInfo, decodeServer, ServerMsg } from "@bomberpump/shared";
import type { RoomInfoMsg, RoomPlayerInfo } from "@bomberpump/shared";

test("RoomInfo round-trips each player's unique colour", () => {
  const players: RoomPlayerInfo[] = [
    { id: 1, name: "Alice", skin: 0, color: 3, ready: true, wins: 2, wallet: "AbC123" },
    { id: 2, name: "Bot Bob", skin: 5, color: 7, ready: true, wins: 0, wallet: "" },
    { id: 3, name: "Carol", skin: 2, color: 0, ready: false, wins: 1, wallet: "" },
  ];
  const buf = encodeRoomInfo("ROOM42", 1, true, 1500, 250, 0, true, 3, players);
  const msg = decodeServer(buf) as RoomInfoMsg;
  assert.equal(msg.type, ServerMsg.ROOM_INFO);
  assert.equal(msg.code, "ROOM42");
  assert.equal(msg.players.length, 3);
  for (let i = 0; i < players.length; i++) {
    assert.equal(msg.players[i].id, players[i].id);
    assert.equal(msg.players[i].name, players[i].name);
    assert.equal(msg.players[i].skin, players[i].skin);
    assert.equal(msg.players[i].color, players[i].color, `colour for player ${players[i].id}`);
    assert.equal(msg.players[i].ready, players[i].ready);
    assert.equal(msg.players[i].wins, players[i].wins);
    assert.equal(msg.players[i].wallet, players[i].wallet);
  }
  // Colours must be distinct — the whole point of lobby-assigned colours.
  const colours = new Set(msg.players.map((p) => p.color));
  assert.equal(colours.size, players.length);
});
