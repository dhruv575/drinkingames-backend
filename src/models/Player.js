const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(socketId, username) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.username = username;
    this.isHost = false;
    this.lobbyCode = null;
    this.disconnected = false;
    this.disconnectTimeout = null;
  }

  toPublic() {
    return {
      id: this.id,
      username: this.username,
      isHost: this.isHost,
      disconnected: this.disconnected
    };
  }
}

module.exports = Player;
