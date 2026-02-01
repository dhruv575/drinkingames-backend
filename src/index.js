const { createServer } = require('http');
const { Server } = require('socket.io');
const { setupSocketHandlers } = require('./socket');

const PORT = process.env.PORT || 3001;

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Basic health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Create Socket.IO server with CORS config
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://games.droov.info'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set up socket handlers
setupSocketHandlers(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║    🎮 Drinkingames Server Running! 🍻      ║
║                                            ║
║    Port: ${PORT}                              ║
║    Health: http://localhost:${PORT}/health    ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  io.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
