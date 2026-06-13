<template>
  <div style="height: calc(100vh - 180px); display: flex; gap: 16px">
    <el-card style="width: 280px; flex-shrink: 0">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>对话历史</span>
          <el-button size="small" type="primary" @click="handleNewChat">新建</el-button>
        </div>
      </template>
      <el-menu :default-active="activeConvId" @select="handleSelectConv">
        <el-menu-item v-for="conv in conversations" :key="conv.id" :index="conv.id">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ conv.title || conv.id.slice(0, 8) }}</span>
        </el-menu-item>
      </el-menu>
    </el-card>
    <el-card style="flex: 1; display: flex; flex-direction: column">
      <div style="display: flex; gap: 8px; margin-bottom: 16px">
        <el-select v-model="currentKbId" placeholder="选择知识库" style="width: 200px">
          <el-option v-for="kb in kbList" :key="kb.id" :label="kb.name" :value="kb.id" />
        </el-select>
      </div>
      <div ref="messagesRef" style="flex: 1; overflow-y: auto; margin-bottom: 16px">
        <div v-for="msg in messages" :key="msg.id" :style="{ display: 'flex', marginBottom: '16px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }">
          <div :style="{ maxWidth: '70%', padding: '10px 16px', borderRadius: '8px', background: msg.role === 'user' ? '#409eff' : '#f0f0f0', color: msg.role === 'user' ? '#fff' : '#333' }">
            <div style="font-size: 12px; color: #999; margin-bottom: 4px">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
            <div style="white-space: pre-wrap">{{ msg.content }}</div>
            <div v-if="msg.citations?.length" style="margin-top: 8px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 4px">
              <div v-for="(c, i) in msg.citations" :key="i">📄 {{ c.title || c.documentTitle }}</div>
            </div>
          </div>
        </div>
        <div v-if="streaming" style="display: flex; justify-content: flex-start">
          <div style="max-width: 70%; padding: 10px 16px; border-radius: 8px; background: #f0f0f0">
            <div style="font-size: 12px; color: #999; margin-bottom: 4px">AI</div>
            <div style="white-space: pre-wrap">
              <span ref="streamContentEl"></span>
              <span style="animation: blink 1s infinite">▍</span>
            </div>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 8px">
        <el-input v-model="inputText" placeholder="请输入问题..." size="large" @keyup.enter="handleSend" :disabled="streaming" />
        <el-button type="primary" size="large" @click="handleSend" :disabled="streaming || !inputText.trim()">发送</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { chatApi } from '@/api/chat';
import { knowledgeBaseApi } from '@/api/knowledgeBase';

const conversations = ref<any[]>([]);
const messages = ref<any[]>([]);
const kbList = ref<any[]>([]);
const currentKbId = ref('');
const activeConvId = ref('');
const inputText = ref('');
const streaming = ref(false);
const streamContent = ref('');
const messagesRef = ref<HTMLDivElement>();
const streamContentEl = ref<HTMLSpanElement>();

async function fetchKbList() {
  const res: any = await knowledgeBaseApi.list();
  kbList.value = res.data || res;
  if (kbList.value.length > 0) currentKbId.value = kbList.value[0].id;
}

async function fetchConversations() {
  const res: any = await chatApi.listConversations(currentKbId.value);
  conversations.value = res.data || res;
}

async function handleNewChat() {
  if (!currentKbId.value) { ElMessage.warning('请先选择知识库'); return; }
  const res: any = await chatApi.createConversation({ kbId: currentKbId.value, title: '新对话' });
  const conv = res.data || res;
  activeConvId.value = conv.id;
  messages.value = [];
  conversations.value.unshift(conv);
}

async function handleSelectConv(id: string) {
  activeConvId.value = id;
  const res: any = await chatApi.getMessages(id);
  messages.value = res.data || res;
}

async function handleSend() {
  if (!inputText.value.trim() || !activeConvId.value) {
    if (!activeConvId.value) await handleNewChat();
    return;
  }
  const text = inputText.value;
  inputText.value = '';
  messages.value.push({ id: Date.now().toString(), role: 'user', content: text });

  streaming.value = true;
  streamContent.value = '';
  let citations: any[] = [];

  // 清空流式内容区域
  if (streamContentEl.value) {
    streamContentEl.value.textContent = '';
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/conversations/${activeConvId.value}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ content: text, kbId: currentKbId.value }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || '请求失败');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('无法获取响应流');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'chunk') {
            streamContent.value += data.content;
            // 直接操作 DOM，确保实时更新，不受 Vue 响应式批处理影响
            if (streamContentEl.value) {
              streamContentEl.value.textContent += data.content;
            }
            // 滚动到底部
            if (messagesRef.value) {
              messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
            }
          } else if (data.type === 'done') {
            citations = data.citations || [];
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        } catch (e) {
          // ignore parse error
        }
      }
    }

    messages.value.push({
      id: Date.now().toString(),
      role: 'assistant',
      content: streamContent.value,
      citations,
    });
  } catch (err: any) {
    ElMessage.error(err.message || '发送失败');
  } finally {
    streaming.value = false;
  }
  await nextTick();
  messagesRef.value?.scrollTo(0, messagesRef.value.scrollHeight);
}

onMounted(async () => {
  await fetchKbList();
  await fetchConversations();
});
</script>

<style>
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
