const { Server } = require('socket.io');
const env = require('./env');

let io = null;

function initIo(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientUrls,
      credentials: true,
    },
  });
  return io;
}

function getIo() {
  return io;
}

module.exports = { initIo, getIo };
