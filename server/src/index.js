import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.js';
import financeRouter from './routes/finance.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getGroqConfigStatus, getConfiguredGroqModel } from './services/groqService.js';

// Load server/.env reliably regardless of working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

// Health check endpoint (never exposes secrets)
const healthHandler = (req, res) => {
  const configStatus = getGroqConfigStatus();
  const { model } = getConfiguredGroqModel();

  res.json({
    status: 'healthy',
    service: 'SpendWise AI API',
    provider: 'groq',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    groqConfigured: configStatus.configured,
    geminiConfigured: configStatus.configured,
    openaiConfigured: configStatus.configured,
    configuredModel: configStatus.configured ? model : 'deterministic-rules-engine'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes (supports both direct server and serverless rewrites)
app.use('/api/chat', chatRouter);
app.use('/chat', chatRouter);
app.use('/api/finance', financeRouter);
app.use('/finance', financeRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Central error handler
app.use(errorHandler);

// Start server if run directly and not imported for testing
const isDirectRun = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('src/index.js') || process.argv[1].endsWith('src\\index.js'))
);

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const configStatus = getGroqConfigStatus();
  const { model } = getConfiguredGroqModel();
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🏦 SpendWise AI Backend Server`);
    console.log(`🚀 Running on port: http://localhost:${PORT}`);
    console.log(
      `🤖 AI Provider: GroqCloud (${
        configStatus.configured
          ? `Configured: ${model} via groq-sdk`
          : `Offline Fallback Mode: ${configStatus.reason}`
      })`
    );
    console.log(`===============================================`);
  });
}

export default app;
