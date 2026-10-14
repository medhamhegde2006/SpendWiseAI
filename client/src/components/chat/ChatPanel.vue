<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
    <!-- Chat Header -->
    <div class="bg-navy-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
          <AppIcon name="bot" :size="20" />
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-sm font-bold text-white">SpendWise AI Advisor</h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Grounded Math
            </span>
          </div>
          <p class="text-[11px] text-slate-300">
            <template v-if="chatStore.lastVerifiedSource === 'groq'">
              Verified Live GroqCloud ({{ chatStore.backendStatus.configuredModel || 'openai/gpt-oss-120b' }})
            </template>
            <template v-else-if="chatStore.lastVerifiedSource === 'offline-fallback'">
              <span v-if="chatStore.lastFallbackReason?.code === 'rate_limited' || chatStore.lastFallbackReason?.code === 'quota_exceeded'">
                Groq Rate Limit Active (429) • Grounded Fallback Active
              </span>
              <span v-else-if="chatStore.lastFallbackReason?.code === 'backend_unreachable'">
                Backend Offline • Grounded Fallback Active
              </span>
              <span v-else>
                Served via Offline Deterministic Fallback
              </span>
            </template>
            <template v-else-if="chatStore.backendStatus.groqConfigured || chatStore.backendStatus.geminiConfigured">
              Groq Key Configured ({{ chatStore.backendStatus.configuredModel || 'openai/gpt-oss-120b' }}) • Awaiting Test
            </template>
            <template v-else>
              Offline Deterministic Engine Ready
            </template>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="chatStore.clearHistory()"
          class="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/10 transition"
          title="Clear conversation history"
        >
          Reset Chat
        </button>
        <button
          v-if="closable"
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
        >
          <AppIcon name="close" :size="18" />
        </button>
      </div>
    </div>

    <!-- Development-Only Status Bar (distinguishes Live Groq vs Offline Fallback) -->
    <div
      v-if="isDevMode"
      class="px-4 py-1.5 text-[11px] font-mono border-b flex items-center justify-between gap-2 shrink-0"
      :class="
        chatStore.lastVerifiedSource === 'groq'
          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
          : chatStore.lastVerifiedSource === 'offline-fallback'
          ? 'bg-amber-950 text-amber-300 border-amber-800'
          : 'bg-slate-800 text-slate-300 border-slate-700'
      "
    >
      <div class="flex items-center gap-2 truncate">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="
            chatStore.lastVerifiedSource === 'groq'
              ? 'bg-emerald-400'
              : chatStore.lastVerifiedSource === 'offline-fallback'
              ? 'bg-amber-400'
              : 'bg-slate-400'
          "
        ></span>
        <span v-if="chatStore.lastVerifiedSource === 'groq'">
          [DEV] VERIFIED: Live GroqCloud ({{ chatStore.backendStatus.configuredModel || 'openai/gpt-oss-120b' }})
        </span>
        <span v-else-if="chatStore.lastVerifiedSource === 'offline-fallback'">
          [DEV] OFFLINE FALLBACK ({{ chatStore.lastFallbackReason?.code === 'rate_limited' ? 'Groq Rate Limit 429' : (chatStore.lastFallbackReason?.code || 'deterministic-rules') }})
        </span>
        <span v-else>
          [DEV] STATUS: {{ (chatStore.backendStatus.groqConfigured || chatStore.backendStatus.geminiConfigured) ? 'Key Loaded (Send message to verify live API)' : 'No API Key (Offline Mode)' }}
        </span>
      </div>
      <span class="text-[10px] opacity-80 shrink-0">DEV ONLY</span>
    </div>

    <!-- Grounded Financial Context Strip -->
    <div class="bg-slate-50 border-b border-slate-200/70 px-4 py-2 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
      <span>
        Live Context: <strong>{{ formatINR(financeStore.stats.currentBalance) }}</strong> Bal •
        <strong>{{ financeStore.transactions.length }}</strong> Txns
      </span>
      <span class="text-emerald-700 font-medium flex items-center gap-1">
        <AppIcon name="shield" :size="12" /> Zero-Hallucination Mode
      </span>
    </div>

    <!-- Messages Scroll Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40"
    >
      <div
        v-for="msg in chatStore.messages"
        :key="msg.id"
        class="flex flex-col"
        :class="msg.role === 'user' ? 'items-end' : 'items-start'"
      >
        <div
          class="max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs"
          :class="
            msg.role === 'user'
              ? 'bg-navy-900 text-white rounded-br-xs'
              : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
          "
        >
          <div
            v-if="msg.role === 'assistant'"
            v-html="renderChatMarkdown(msg.content)"
          ></div>
          <div v-else>{{ msg.content }}</div>

          <!-- Development-only per-message source indicator -->
          <div
            v-if="isDevMode && msg.role === 'assistant' && msg.id !== 'welcome-msg'"
            class="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1 text-[10px] font-mono"
          >
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                v-if="!msg.isFallback && msg.source === 'groq'"
                class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
              >
                ● LIVE GROQ ({{ msg.modelUsed }} • {{ msg.devStatus?.apiEndpoint || 'chat.completions.create' }})
              </span>
              <span
                v-else
                class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold"
              >
                ○ OFFLINE FALLBACK ({{ msg.fallbackReason?.code === 'rate_limited' ? 'Groq Rate Limit 429' : (msg.fallbackReason?.code || 'deterministic-rules') }})
              </span>
            </div>
            <p
              v-if="msg.isFallback && msg.fallbackReason?.message"
              class="text-amber-700 text-[10px]"
            >
              {{ msg.fallbackReason.message }}
            </p>
            <p
              v-if="msg.isFallback && (msg.fallbackReason?.code === 'rate_limited' || msg.fallbackReason?.code === 'quota_exceeded')"
              class="text-amber-600 text-[10px]"
            >
              💡 GroqCloud API rate limit active. All financial figures are deterministically calculated from your live records with zero hallucinations.
            </p>
          </div>
        </div>

        <span class="text-[10px] text-slate-400 mt-1 px-1">
          {{ msg.role === 'user' ? 'You' : 'SpendWise AI' }}
          <template v-if="msg.modelUsed"> • {{ msg.modelUsed }}</template>
        </span>
      </div>

      <!-- Typing Indicator -->
      <div v-if="chatStore.isTyping" class="flex items-start gap-2">
        <div class="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
          <span class="flex gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:150ms]"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:300ms]"></span>
          </span>
          <span>Analyzing verified account metrics with GroqCloud...</span>
        </div>
      </div>
    </div>

    <!-- Quick Suggested Prompts -->
    <div class="px-4 py-2.5 bg-white border-t border-slate-100 shrink-0">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
        Quick Questions
      </div>
      <div class="flex gap-1.5 overflow-x-auto pb-1">
        <button
          v-for="prompt in chatStore.suggestedPrompts"
          :key="prompt"
          @click="sendQuickPrompt(prompt)"
          :disabled="chatStore.isTyping"
          class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-slate-700 whitespace-nowrap transition shrink-0 disabled:opacity-50"
        >
          {{ prompt }}
        </button>
      </div>
    </div>

    <!-- Input Box -->
    <form
      @submit.prevent="handleSend"
      class="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
    >
      <input
        v-model="inputMessage"
        type="text"
        maxlength="450"
        :disabled="chatStore.isTyping"
        placeholder="Ask about your spending, food expenses, or savings goals..."
        class="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60"
      />
      <button
        type="submit"
        :disabled="!inputMessage.trim() || chatStore.isTyping"
        class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
      >
        <AppIcon name="send" :size="14" />
        <span>Ask</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { useChatStore } from '../../stores/chatStore.js';
import { useFinanceStore } from '../../stores/financeStore.js';
import { formatINR, renderChatMarkdown } from '../../utils/formatters.js';
import AppIcon from '../common/AppIcon.vue';

defineProps({
  closable: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close']);

const chatStore = useChatStore();
const financeStore = useFinanceStore();

const isDevMode = Boolean(import.meta.env.DEV);
const inputMessage = ref('');
const messagesContainer = ref(null);

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

async function handleSend() {
  const text = inputMessage.value.trim();
  if (!text) return;
  inputMessage.value = '';
  scrollToBottom();
  await chatStore.askQuestion(text);
  scrollToBottom();
}

async function sendQuickPrompt(promptText) {
  scrollToBottom();
  await chatStore.askQuestion(promptText);
  scrollToBottom();
}

watch(
  () => chatStore.messages.length,
  () => scrollToBottom()
);

onMounted(() => {
  chatStore.verifyBackend();
  scrollToBottom();
});
</script>
