const { generateUniqueLobbyCode } = require('../utils/codeGenerator');

class Lobby {
  static lobbies = new Map();

  constructor(host) {
    this.code = generateUniqueLobbyCode(new Set(Lobby.lobbies.keys()));
    this.players = new Map();
    this.hostId = host.id;
    this.currentGame = null;
    this.gameState = null;
    this.createdAt = Date.now();

    // Add host to the lobby
    this.addPlayer(host);
    host.isHost = true;
    host.lobbyCode = this.code;

    Lobby.lobbies.set(this.code, this);
  }

  addPlayer(player) {
    if (this.players.size >= 8) {
      throw new Error('Lobby is full (max 8 players)');
    }
    if (this.currentGame) {
      throw new Error('Cannot join while a game is in progress');
    }
    this.players.set(player.id, player);
    player.lobbyCode = this.code;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.lobbyCode = null;
      this.players.delete(playerId);

      // If host leaves, assign new host or destroy lobby
      if (playerId === this.hostId) {
        if (this.players.size > 0) {
          const newHost = this.players.values().next().value;
          newHost.isHost = true;
          this.hostId = newHost.id;
          return { newHost };
        } else {
          this.destroy();
          return { destroyed: true };
        }
      }
    }
    return {};
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return null;
  }

  isHost(playerId) {
    return this.hostId === playerId;
  }

  getHost() {
    return this.players.get(this.hostId);
  }

  startGame(gameName) {
    if (this.players.size < 2) {
      throw new Error('Need at least 2 players to start a game');
    }
    this.currentGame = gameName;
    this.gameState = {};
  }

  endGame() {
    this.currentGame = null;
    this.gameState = null;
  }

  destroy() {
    for (const player of this.players.values()) {
      player.lobbyCode = null;
      player.isHost = false;
    }
    Lobby.lobbies.delete(this.code);
  }

  toPublic() {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()).map(p => p.toPublic()),
      currentGame: this.currentGame,
      playerCount: this.players.size
    };
  }

  static findByCode(code) {
    return Lobby.lobbies.get(code?.toUpperCase());
  }

  static findByPlayerId(playerId) {
    for (const lobby of Lobby.lobbies.values()) {
      if (lobby.players.has(playerId)) {
        return lobby;
      }
    }
    return null;
  }
}

module.exports = Lobby;
