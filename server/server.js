const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const env = require('./src/config/env');
const { initIo } = require('./src/config/socketIo');
const { registerSocketHandlers } = require('./src/socket');
const { apiLimiter } = require('./src/middleware/rateLimiters');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/authRoutes');
const usersRoutes = require('./src/routes/usersRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();
const server = http.createServer(app);
initIo(server);
registerSocketHandlers();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

app.use(notFound);
app.use(errorHandler);

server.listen(env.port, () => {
  console.log(`VibeChat API listening on port ${env.port}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
