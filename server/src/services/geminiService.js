/**
 * Backwards-compatibility proxy: delegates to the active Groq Provider Service
 */
export {
  getChatbotResponse,
  sanitizeErrorMessage,
  classifyGroqError as classifyGeminiError,
  getGroqConfigStatus as getGeminiConfigStatus,
  getConfiguredGroqModel as getConfiguredGeminiModel,
  isGreetingQuery,
  generateGreetingResponse,
  generateDeterministicFallback,
  getGroqCooldownStatus as getGeminiCooldownStatus,
  resetGroqCooldown as resetGeminiCooldown,
  DEFAULT_GROQ_MODEL as DEFAULT_GEMINI_MODEL,
  SUPPORTED_GROQ_MODELS as SUPPORTED_GEMINI_MODELS
} from './groqService.js';
