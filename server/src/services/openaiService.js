/**
 * Backwards compatibility proxy: delegates to the active Groq Provider Service
 */
export {
  getChatbotResponse,
  sanitizeErrorMessage,
  getGroqConfigStatus as getOpenAIConfigStatus,
  getConfiguredGroqModel as getConfiguredModel
} from './groqService.js';
