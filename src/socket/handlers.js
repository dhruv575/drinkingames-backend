const Player = require('../models/Player');
const Lobby = require('../models/Lobby');
const { getAvailableGames, getGame } = require('../games');

// Track players by socket ID
const playersBySocket = new Map();

/**
 * Validate username (min 4 letters)
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();
  if (trimmed.length < 4) {
    return { valid: false, error: 'Username must be at least 4 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  return { valid: true, username: trimmed };
}

/**
 * Set up socket event handlers
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Create lobby
    socket.on('lobby:create', (data, callback) => {
      try {
        const validation = validateUsername(data.username);
        if (!validation.valid) {
          return callback({ error: validation.error });
        }

        // Create player
        const player = new Player(socket.id, validation.username);
        playersBySocket.set(socket.id, player);

        // Create lobby
        const lobby = new Lobby(player);
        socket.join(lobby.code);

        console.log(`Lobby created: ${lobby.code} by ${player.username}`);

        callback({
          success: true,
          lobbyCode: lobby.code,
          player: player.toPublic(),
          lobby: lobby.toPublic()
        });
      } catch (error) {
        console.error('Error creating lobby:', error);
        callback({ error: error.message });
      }
    });

    // Join lobby
    socket.on('lobby:join', (data, callback) => {
      try {
        const validation = validateUsername(data.username);
        if (!validation.valid) {
          return callback({ error: validation.error });
        }

        const lobbyCode = data.lobbyCode?.toUpperCase();
        if (!lobbyCode || lobbyCode.length !== 4) {
          return callback({ error: 'Invalid lobby code' });
        }

        const lobby = Lobby.findByCode(lobbyCode);
        if (!lobby) {
          return callback({ error: 'Lobby not found' });
        }

        // Check if username is already taken in this lobby
        for (const existingPlayer of lobby.players.values()) {
          if (existingPlayer.username.toLowerCase() === validation.username.toLowerCase()) {
            return callback({ error: 'Username already taken in this lobby' });
          }
        }

        // Create player and add to lobby
        const player = new Player(socket.id, validation.username);
        playersBySocket.set(socket.id, player);
        lobby.addPlayer(player);

        socket.join(lobby.code);

        console.log(`Player ${player.username} joined lobby ${lobby.code}`);

        // Notify other players
        socket.to(lobby.code).emit('lobby:player-joined', {
          player: player.toPublic(),
          lobby: lobby.toPublic()
        });

        callback({
          success: true,
          player: player.toPublic(),
          lobby: lobby.toPublic()
        });
      } catch (error) {
        console.error('Error joining lobby:', error);
        callback({ error: error.message });
      }
    });

    // Leave lobby
    socket.on('lobby:leave', (callback) => {
      const result = handlePlayerLeave(socket, io);
      if (callback) callback(result);
    });

    // Get available games
    socket.on('games:list', (callback) => {
      callback({ games: getAvailableGames() });
    });

    // Start a game (host only)
    socket.on('game:start', (data, callback) => {
      try {
        const player = playersBySocket.get(socket.id);
        if (!player || !player.lobbyCode) {
          return callback({ error: 'Not in a lobby' });
        }

        const lobby = Lobby.findByCode(player.lobbyCode);
        if (!lobby) {
          return callback({ error: 'Lobby not found' });
        }

        if (!lobby.isHost(player.id)) {
          return callback({ error: 'Only the host can start a game' });
        }

        const gameModule = getGame(data.gameId);
        if (!gameModule) {
          return callback({ error: 'Invalid game' });
        }

        if (lobby.players.size < 2) {
          return callback({ error: 'Need at least 2 players to start' });
        }

        // Initialize the game
        lobby.startGame(data.gameId);
        gameModule.initGame(lobby, io);

        console.log(`Game ${data.gameId} started in lobby ${lobby.code}`);

        // Notify all players
        io.to(lobby.code).emit('game:started', {
          gameId: data.gameId,
          lobby: lobby.toPublic()
        });

        // Start the game-specific flow
        if (data.gameId === 'dead-draw-poker') {
          gameModule.startDealing(lobby, io);
        } else if (data.gameId === 'drawing-game') {
          gameModule.startWordSubmission(lobby, io);
        }

        callback({ success: true });
      } catch (error) {
        console.error('Error starting game:', error);
        callback({ error: error.message });
      }
    });

    // Handle game action
    socket.on('game:action', (data, callback) => {
      try {
        const player = playersBySocket.get(socket.id);
        if (!player || !player.lobbyCode) {
          return callback({ error: 'Not in a lobby' });
        }

        const lobby = Lobby.findByCode(player.lobbyCode);
        if (!lobby || !lobby.currentGame) {
          return callback({ error: 'No game in progress' });
        }

        const gameModule = getGame(lobby.currentGame);
        if (!gameModule) {
          return callback({ error: 'Invalid game state' });
        }

        const result = gameModule.handleAction(lobby, player.id, data.action, data.data || {}, io);
        callback(result);
      } catch (error) {
        console.error('Error handling game action:', error);
        callback({ error: error.message });
      }
    });

    // End game and return to lobby (host only)
    socket.on('game:end', (callback) => {
      try {
        const player = playersBySocket.get(socket.id);
        if (!player || !player.lobbyCode) {
          return callback({ error: 'Not in a lobby' });
        }

        const lobby = Lobby.findByCode(player.lobbyCode);
        if (!lobby) {
          return callback({ error: 'Lobby not found' });
        }

        if (!lobby.isHost(player.id)) {
          return callback({ error: 'Only the host can end the game' });
        }

        if (lobby.currentGame) {
          const gameModule = getGame(lobby.currentGame);
          if (gameModule) {
            gameModule.endGame(lobby);
          }
        }

        console.log(`Game ended in lobby ${lobby.code}`);

        io.to(lobby.code).emit('game:ended', {
          lobby: lobby.toPublic()
        });

        callback({ success: true });
      } catch (error) {
        console.error('Error ending game:', error);
        callback({ error: error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      handlePlayerLeave(socket, io);
    });
  });
}

/**
 * Handle a player leaving (disconnect or explicit leave)
 */
function handlePlayerLeave(socket, io) {
  const player = playersBySocket.get(socket.id);
  if (!player) {
    return { success: true };
  }

  const lobby = player.lobbyCode ? Lobby.findByCode(player.lobbyCode) : null;

  if (lobby) {
    const result = lobby.removePlayer(player.id);

    socket.leave(lobby.code);

    if (result.destroyed) {
      console.log(`Lobby ${lobby.code} destroyed (empty)`);
    } else if (result.newHost) {
      // Notify remaining players about new host
      io.to(lobby.code).emit('lobby:host-changed', {
        newHost: result.newHost.toPublic(),
        lobby: lobby.toPublic()
      });
      console.log(`New host in ${lobby.code}: ${result.newHost.username}`);
    }

    // Notify remaining players
    io.to(lobby.code).emit('lobby:player-left', {
      player: player.toPublic(),
      lobby: lobby.toPublic()
    });
  }

  playersBySocket.delete(socket.id);
  return { success: true };
}

module.exports = {
  setupSocketHandlers
};
