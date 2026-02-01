const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(socketId, username) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.username = username;
    this.isHost = false;
    this.lobbyCode = null;
  }

  toPublic() {
    return {
      id: this.id,
      username: this.username,
      isHost: this.isHost
    };
  }
}

module.exports = Player;
