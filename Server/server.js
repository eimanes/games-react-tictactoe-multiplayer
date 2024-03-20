const http  = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");

dotenv.config();

const server = http.createServer();
const io = new Server(server, {
  cors: "https://react-tic-tac-toe-socket.vercel.app/",
});

const allUsers = {}; // Object to store all connected users
const allRooms = {}; // Object to store all created rooms

io.on("connection", (socket) => {
  // When a new user connects, add them to the allUsers object
  allUsers[socket.id] = {
    socket: socket,
    online: true,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    const roomId = data.roomId;
    let room = allRooms[roomId];

    // If the room doesn't exist, create it with the current user as player1
    if (!room) {
      room = allRooms[roomId] = {
        player1: currentUser,
        player2: null
      };
    } else if (!room.player2) {
      // If the room exists and player2 slot is empty, add current user as player2
      room.player2 = currentUser;
    } else {
      // If the room is full, emit "RoomFull" event to the current user
      currentUser.socket.emit("RoomFull");
      return;
    }

    currentUser.playing = true;

    // If both players are present, emit "OpponentFound" event to both players
    if (room.player2) {
      room.player1.socket.emit("OpponentFound", {
        opponentName: room.player2.playerName,
        playingAs: "circle",
      });

      room.player2.socket.emit("OpponentFound", {
        opponentName: room.player1.playerName,
        playingAs: "cross",
      });

      // Relay player moves between players
      room.player1.socket.on("playerMoveFromClient", (data) => {
        room.player2.socket.emit("playerMoveFromServer", { ...data });
      });

      room.player2.socket.on("playerMoveFromClient", (data) => {
        room.player1.socket.emit("playerMoveFromServer", { ...data });
      });
    } else {
      // If only one player is present, emit "WaitingForOpponent" event to that player
      currentUser.socket.emit("WaitingForOpponent");
    }
  });

  socket.on("disconnect", function () {
    const currentUser = allUsers[socket.id];
    currentUser.online = false;
    currentUser.playing = false;

    // Iterate through all rooms to find the room where the disconnected user was playing
    for (const roomId in allRooms) {
      const room = allRooms[roomId];
      if (room.player1 && room.player1.socket.id === socket.id) {
        if (room.player2) {
          // If the disconnected player was player1, notify player2 about opponent's disconnection
          room.player2.socket.emit("opponentLeftMatch");
          delete allRooms[roomId];
        }
        break;
      } else if (room.player2 && room.player2.socket.id === socket.id) {
        if (room.player1) {
          // If the disconnected player was player2, notify player1 about opponent's disconnection
          room.player1.socket.emit("opponentLeftMatch");
          delete allRooms[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
	console.log(`Server Running on port ${PORT}`);
});
