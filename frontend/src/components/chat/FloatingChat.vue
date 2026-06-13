<template>
  <Teleport to="body">
    <!-- FAB Button -->
    <button
      v-if="!chat.isOpen"
      class="chat-fab"
      @click="chat.open()"
      title="知识问答"
    >
      <el-icon :size="24"><ChatDotSquare /></el-icon>
    </button>

    <!-- Chat Panel -->
    <Transition name="chat-slide">
      <div v-if="chat.isOpen" class="chat-panel open">
        <!-- Header -->
        <div class="chat-panel-header">
          <span class="chat-panel-title">知识问答</span>
          <button class="chat-panel-close" @click="chat.close()">
            <el-icon :size="16"><Close /></el-icon>
          </button>
        </div>

        <!-- Sidebar Toggle & New Chat -->
        <div class="chat-toolbar">
          <button class="chat-toolbar-btn" @click="showHistory = !showHistory" :title="showHistory ? '隐藏历史' : '历史对话'">
            <el-icon :size="14"><Clock /></el-icon>
            <span>历史</span>
          </button>
          <button class="chat-toolbar-btn primary" @click="handleNewChat">
            <el-icon :size="14"><Plus /></el-icon>
            <span>新对话</span>
          </button>
        </div>

        <!-- History Panel -->
        <Transition name="slide-down">
          <div v-if="showHistory" class="chat-history-panel">
            <div v-if="chat.conversations.length === 0" class="chat-history-empty">
              暂无历史对话
            </div>
            <div
              v-for="conv in chat.conversations"
              :key="conv.id"
              class="chat-history-item"
              :class="{ active: conv.id === chat.currentConvId }"
              @click="handleSelectConv(conv.id)"
            >
              <div class="chat-history-item-content">
                <el-icon :size="12"><ChatDotSquare /></el-icon>
                <span class="chat-history-item-title">{{ conv.title || '未命名对话' }}</span>
              </div>
              <button class="chat-history-item-delete" @click.stop="handleDeleteConv(conv.id)" title="删除">
                <el-icon :size="12"><Delete /></el-icon>
              </button>
            </div>
          </div>
        </Transition>

        <!-- Messages -->
        <div class="chat-panel-messages" ref="messagesRef">
          <div
            v-for="msg in chat.messages"
            :key="msg.id"
            class="chat-panel-msg"
          >
            <!-- User message -->
            <div v-if="msg.role === 'user'" class="chat-panel-msg-user">
              <div class="msg-bubble-user">{{ msg.content }}</div>
            </div>
            <!-- Bot message -->
            <div v-else class="chat-panel-msg-ai">
              <div class="msg-avatar-ai">知</div>
              <div class="msg-bubble-ai">
                <div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
                <div v-if="msg.citations?.length" class="msg-citations">
                  <el-tag
                    v-for="(c, i) in uniqueCitations(msg.citations)"
                    :key="i"
                    size="small"
                    type="info"
                    class="citation-tag"
                  >
                    {{ c.title || c.documentTitle }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>

          <!-- Streaming content -->
          <div v-if="chat.streaming" class="chat-panel-msg">
            <div class="chat-panel-msg-ai">
              <div class="msg-avatar-ai">知</div>
              <div class="msg-bubble-ai">
                <div class="markdown-body" v-html="renderMarkdown(chat.streamContent)"></div>
                <span class="stream-cursor">▍</span>
              </div>
            </div>
          </div>

          <!-- Loading indicator (non-streaming) -->
          <div v-if="chat.loading && !chat.streaming" class="chat-panel-msg">
            <div class="chat-panel-msg-ai">
              <div class="msg-avatar-ai">知</div>
              <div class="msg-bubble-ai">
                <span class="typing-indicator">
                  <span></span><span></span><span></span>
                </span>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="!chat.messages.length && !chat.loading"
            class="chat-empty"
          >
            <el-icon :size="36" color="var(--fg-subtle)"><ChatDotSquare /></el-icon>
            <p>输入问题，开始对话</p>
          </div>
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <!-- Selected KB Tag -->
          <div class="chat-input-kb" v-if="chat.selectedKbId && chat.selectedKbId !== 'all'">
            <el-icon :size="12"><FolderOpened /></el-icon>
            <span>{{ currentKbName }}</span>
            <button class="chat-input-kb-remove" @click="chat.selectedKbId = 'all'; handleKbChange()" title="取消选择">
              <el-icon :size="10"><Close /></el-icon>
            </button>
          </div>
          <!-- Input Row -->
          <div class="chat-panel-input">
            <el-popover
              ref="kbPopoverRef"
              placement="top-start"
              :width="220"
              trigger="click"
            >
              <template #reference>
                <button class="chat-attach-btn" :title="chat.selectedKbId === 'all' ? '选择知识库' : '已选择: ' + currentKbName">
                  <el-icon :size="16"><FolderOpened /></el-icon>
                </button>
              </template>
              <div class="chat-kb-popover">
                <div class="chat-kb-popover-title">选择知识库</div>
                <div
                  v-for="kb in chat.kbList"
                  :key="kb.id"
                  class="chat-kb-popover-item"
                  :class="{ active: kb.id === chat.selectedKbId }"
                  @click="chat.selectedKbId = kb.id; handleKbChange()"
                >
                  <el-icon :size="14"><FolderOpened /></el-icon>
                  <span>{{ kb.name }}</span>
                </div>
              </div>
            </el-popover>
            <el-input
              v-model="inputText"
              placeholder="输入你的问题..."
              :disabled="chat.loading"
              @keyup.enter="handleSend"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              resize="none"
            />
            <button
              class="chat-send-btn"
              :disabled="!inputText.trim() || chat.loading"
              @click="handleSend"
            >
              <el-icon :size="16"><Promotion /></el-icon>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue';
import { useChatStore } from '@/stores/chat';
import { marked } from 'marked';

const chat = useChatStore();
const inputText = ref('');
const messagesRef = ref<HTMLDivElement>();
const showHistory = ref(false);
const kbPopoverRef = ref<any>(null);

const currentKbName = computed(() => {
  const kb = chat.kbList.find(k => k.id === chat.selectedKbId);
  return kb?.name || '全部知识库';
});

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(content: string) {
  if (!content) return '';
  try {
    return marked(content) as string;
  } catch {
    return content.replace(/\n/g, '<br>');
  }
}

// Deduplicate citations by documentTitle
function uniqueCitations(citations: any[]) {
  const seen = new Set<string>();
  return citations.filter(c => {
    const key = c.title || c.documentTitle || c.chunkId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function handleNewChat() {
  chat.newConversation();
  showHistory.value = false;
}

async function handleSelectConv(convId: string) {
  await chat.loadMessages(convId);
  showHistory.value = false;
}

async function handleDeleteConv(convId: string) {
  await chat.deleteConversation(convId);
}

function handleKbChange() {
  // Close popover and reset conversation when KB selection changes
  kbPopoverRef.value?.hide();
  chat.newConversation();
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || chat.loading) return;
  inputText.value = '';
  await chat.sendMessage(text);
  await nextTick();
  messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'smooth' });
}

// Auto-scroll on new messages
watch(
  () => chat.messages.length,
  async () => {
    await nextTick();
    messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'smooth' });
  }
);

// Auto-scroll on streaming content update
watch(
  () => chat.streamContent,
  async () => {
    await nextTick();
    messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'auto' });
  }
);

onMounted(async () => {
  await Promise.all([
    chat.fetchConversations(),
    chat.fetchKbList(),
  ]);
});
</script>

<style scoped>
/* FAB */
.chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 500;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--white);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--fab-shadow);
  transition: all 0.2s;
}
.chat-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px var(--s-pri-a12);
}

/* Panel */
.chat-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 500;
  width: 420px;
  height: calc(100vh - 80px);
  max-height: 680px;
  background: var(--chat-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--chat-shadow);
  display: flex;
  flex-direction: column;
}

.chat-panel-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.chat-panel-title {
  font-size: 14px;
  font-weight: 590;
  flex: 1;
  color: var(--fg);
}
.chat-panel-close {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  transition: all 0.15s;
}
.chat-panel-close:hover {
  background: var(--surface-hover);
  color: var(--fg);
}

/* Toolbar */
.chat-toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.chat-toolbar-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.chat-toolbar-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.chat-toolbar-btn.primary {
  background: var(--primary);
  color: var(--white);
  border-color: var(--primary);
}
.chat-toolbar-btn.primary:hover {
  background: var(--primary-hover);
}

/* History Panel */
.chat-history-panel {
  max-height: 200px;
  overflow-y: auto;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.chat-history-empty {
  padding: 20px;
  text-align: center;
  color: var(--fg-muted);
  font-size: 12px;
}
.chat-history-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border);
}
.chat-history-item:last-child {
  border-bottom: none;
}
.chat-history-item:hover {
  background: var(--surface-hover);
}
.chat-history-item.active {
  background: var(--primary-light);
  border-left: 3px solid var(--primary);
}
.chat-history-item-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.chat-history-item-title {
  flex: 1;
  font-size: 13px;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-history-item-delete {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  opacity: 0;
  transition: all 0.15s;
}
.chat-history-item:hover .chat-history-item-delete {
  opacity: 1;
}
.chat-history-item-delete:hover {
  background: var(--danger-light, #fee);
  color: var(--danger, #f56c6c);
}

/* Messages */
.chat-panel-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.chat-panel-msg {
  margin-bottom: 14px;
}
.chat-panel-msg-user {
  display: flex;
  justify-content: flex-end;
}
.msg-bubble-user {
  background: var(--primary);
  color: var(--white);
  border-radius: var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);
  padding: 10px 14px;
  max-width: 80%;
  font-size: 13px;
  line-height: 1.6;
}
.chat-panel-msg-ai {
  display: flex;
  gap: 8px;
}
.msg-avatar-ai {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--brand-gradient);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 590;
  flex-shrink: 0;
}
.msg-bubble-ai {
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg);
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  flex: 1;
  min-width: 0;
}
.msg-citations {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.citation-tag {
  cursor: pointer;
}

/* Markdown body in chat */
.markdown-body {
  font-size: 13px;
  line-height: 1.6;
}
.markdown-body :deep(p) {
  margin: 8px 0;
}
.markdown-body :deep(p:first-child) {
  margin-top: 0;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(code) {
  background: var(--bg2);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
}
.markdown-body :deep(pre) {
  background: var(--bg2);
  padding: 8px 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}
.markdown-body :deep(li) {
  margin: 2px 0;
}
.markdown-body :deep(strong) {
  font-weight: 600;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 12px 0 8px;
  font-weight: 600;
}
.markdown-body :deep(h1) { font-size: 18px; }
.markdown-body :deep(h2) { font-size: 16px; }
.markdown-body :deep(h3) { font-size: 14px; }
.markdown-body :deep(h4) { font-size: 13px; }
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--fg-muted);
}
.markdown-body :deep(a) {
  color: var(--primary);
  text-decoration: none;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 12px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border);
  padding: 4px 8px;
}
.markdown-body :deep(th) {
  background: var(--bg2);
}

/* Empty */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--fg-subtle);
  font-size: 13px;
}

/* Input Area */
.chat-input-area {
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.chat-input-kb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px 0;
  font-size: 12px;
  color: var(--primary);
}
.chat-input-kb span {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-input-kb-remove {
  width: 16px;
  height: 16px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  transition: all 0.15s;
  flex-shrink: 0;
}
.chat-input-kb-remove:hover {
  background: var(--danger-light, #fee);
  color: var(--danger, #f56c6c);
}
.chat-panel-input {
  padding: 8px 12px 12px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-shrink: 0;
}
.chat-attach-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  transition: all 0.15s;
  flex-shrink: 0;
}
.chat-attach-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}

/* KB Popover */
.chat-kb-popover {
  max-height: 240px;
  overflow-y: auto;
}
.chat-kb-popover-title {
  font-size: 12px;
  font-weight: 590;
  color: var(--fg-muted);
  margin-bottom: 8px;
  padding: 0 4px;
}
.chat-kb-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--fg);
  transition: all 0.15s;
}
.chat-kb-popover-item:hover {
  background: var(--surface-hover);
}
.chat-kb-popover-item.active {
  background: var(--primary-light);
  color: var(--primary);
}
.chat-kb-popover-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-send-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  border: none;
  background: var(--primary);
  color: var(--white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.chat-send-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}
.chat-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Streaming cursor */
.stream-cursor {
  animation: blinkCursor 1s infinite;
  color: var(--fg-muted);
}
@keyframes blinkCursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Typing indicator */
.typing-indicator {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg-muted);
  animation: typingBounce 1.2s infinite ease-in-out;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* Transition */
.chat-slide-enter-active,
.chat-slide-leave-active {
  transition: all 0.25s ease;
}
.chat-slide-enter-from,
.chat-slide-leave-to {
  transform: translateY(16px) scale(0.96);
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}
</style>
