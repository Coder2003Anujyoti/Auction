const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const characters = require("./pokemons");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
let index={}
let pokemons={}
let rooms = {};
let auctions={}
let players={}
io.on("connection", (socket) => {
console.log("Connected:", socket.id);
function startAuction(id){
  if(!id || !pokemons[id] || !Array.isArray(pokemons[id])) return;
  let ind = index[id];
  if(typeof ind !== "number" || ind < 0 || ind >= pokemons[id].length) return;
  const current = pokemons[id][ind];
  if(!current) return;
  auctions[id] = {
    name: current.name || "",
    image: current.image || "",
    bid: 0,
    bidders: [],
    timer: 10
  };
  index[id] = ind + 1;
  if(rooms[id]) {
    io.to(id).emit("start-game", {
      players: rooms[id],
      auction: auctions[id]
    });
  }
  startTimer(id);
}
function cleanup(roomId) {
  if (auctions[roomId]?.interval) {
    clearInterval(auctions[roomId].interval);
  }

  if (auctions[roomId]?.breakInterval) {
    clearInterval(auctions[roomId].breakInterval);
  }

  delete rooms[roomId];
  delete index[roomId];
  delete auctions[roomId];
  delete pokemons[roomId];
  delete players[roomId];
}
function checkBid(id){
  const pokemon = pokemons[id];
  const auction = auctions[id];
  if (!pokemon || !auction || !rooms[id]) return;
  let flag = -1;
  let poke = pokemon.map((i, ind) => {
    if (i.name === auction.name) {
      flag = ind;
      return {
        ...i,
        sold: (auction.bidders && auction.bidders.length > 0)
          ? auction.bidders[auction.bidders.length - 1]
          : "Unsold"
      };
    }
    return { ...i };
  });
  pokemons[id] = poke;
  if (auction.bidders && auction.bidders.length > 0 && flag !== -1) {
    const winner = auction.bidders[auction.bidders.length - 1];
    rooms[id] = rooms[id].map((player) => {
      if (player.name === winner && pokemon[flag]) {
        return {
          ...player,
          players: [...(player.players || []), pokemon[flag]],
          purse: (player.purse ?? 0) - (auction.bid ?? 0)
        };
      }
      return { ...player };
    });
  }
  if (!poke.some((i) => i.sold === "")) {
    let k = poke.filter((i) => i.sold === "Unsold");
    let idx = 0;
    rooms[id] = rooms[id].map(player => {
      let need = 5 - (player.players?.length || 0);
      if (need <= 0) return player;
      let add = k.slice(idx, idx + need);
      idx += need;
      return {
        ...player,
        players: [...(player.players || []), ...add]
      };
    });
    io.to(id).emit("final-updates", { players: rooms[id] }, () => {
  cleanup(id);
});
  } else {
    io.to(id).emit("updates", {
      players: rooms[id],
      data: auctions[id]
    });
  }
}
function startTimer(roomId) {
  const auction = auctions[roomId];
  if (!auction) return;

  if (auction.interval) clearInterval(auction.interval);

  auction.interval = setInterval(() => {
    if (!auctions[roomId]) {
      clearInterval(auction.interval);
      return;
    }

    auctions[roomId].timer--;

    io.to(roomId).emit("timer", auctions[roomId].timer);

    if (auctions[roomId].timer <= 0) {
      clearInterval(auction.interval);

      checkBid(roomId);

      let wait = 5;

      io.to(roomId).emit("round-end", {
        message: "Round ended",
        nextIn: wait
      });

      auction.breakInterval = setInterval(() => {
        if (!auctions[roomId]) {
          clearInterval(auction.breakInterval);
          return;
        }

        wait--;

        io.to(roomId).emit("round-end", {
          nextIn: wait
        });

        if (wait <= 0) {
          clearInterval(auction.breakInterval);
          if (auctions[roomId]) startAuction(roomId);
        }
      }, 1000);
    }
  }, 1000);
}
socket.on("join-room", (msg) => {
  if (!msg || !msg.name || !msg.id) return;
  const name = msg.name;
  const roomId = msg.id;
  if (!rooms[roomId]) {
    rooms[roomId] = [];
  }
  if (!Array.isArray(rooms[roomId])) return;
  if (rooms[roomId].length >= 4) {
    return;
  }
  socket.join(roomId);
  rooms[roomId].push({
    id: socket.id,
    name,
    players: [],
    roomID: roomId,
    purse: 5000
  });
  if (rooms[roomId].length < 4) {
    io.to(roomId).emit("wait", {
      msg: "Waiting for others....."
    });
  }
  if (rooms[roomId].length === 4) {
    players[roomId] = [...rooms[roomId]];
    index[roomId] = 0;

    const updatedPokemons = (characters || [])
    pokemons[roomId] = updatedPokemons
      .slice(0,20)
      .map(i => ({ ...i, sold: "" }));
    if (pokemons[roomId]?.length) {
      startAuction(roomId);
    }
  }
});
socket.on("move-bid", (msg) => {
  const id = msg.id;
  if (!auctions[id] || !rooms[id]) return;
  if (typeof auctions[id].bid !== "number") {
    auctions[id].bid = 0;
  }
  if (!Array.isArray(auctions[id].bidders)) {
    auctions[id].bidders = [];
  }
  if (!msg || !msg.name) return;
  const lastBidder = auctions[id].bidders[auctions[id].bidders.length - 1];
  if (lastBidder === msg.name) return;
  auctions[id].bid += 100;
  auctions[id].bidders.push(msg.name);
  io.to(id).emit("bid-update", {
    bid: auctions[id].bid,
    bidders: auctions[id].bidders,
    room: rooms[id]
  });
});
socket.once('disconnect', () => {
  console.log("Player disconnected:", socket.id);
  for (const roomId in rooms) {
    if (!rooms[roomId] || !players[roomId]) continue;
    players[roomId] = (players[roomId] || []).filter(p => p.id !== socket.id);
    if (!Array.isArray(players[roomId])) continue;
    if (players[roomId].length === 1) {
      const lastUserId = players[roomId][0]?.id;
      if (lastUserId) {
        io.to(lastUserId).emit("Left", "A player has been disconnected...");
      }
      if (auctions[roomId]?.interval) clearInterval(auctions[roomId].interval);
      if (auctions[roomId]?.breakInterval) clearInterval(auctions[roomId].breakInterval);
      delete rooms[roomId];
      delete index[roomId];
      delete auctions[roomId];
      delete pokemons[roomId];
      delete players[roomId];
      break;
    }
    if (players[roomId].length === 0) {
      if (auctions[roomId]?.interval) clearInterval(auctions[roomId].interval);
      if (auctions[roomId]?.breakInterval) clearInterval(auctions[roomId].breakInterval);
      delete rooms[roomId];
      delete index[roomId];
      delete auctions[roomId];
      delete pokemons[roomId];
      delete players[roomId];
      break;
    }
  }
});
});
server.listen(8000, () => {
  console.log("🚀 Server running on port 8000");
});