import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatApi } from '@/api/chat';
import { knowledgeBaseApi } from '@/api/knowledgeBase';

export const useChatStore = defineStore('chat', () => {
  const isOpen = ref(false);
  const conversations = ref<any[]>([]);
  const messages = ref<any[]>([]);
  const currentConvId = ref('');
  const loading = ref(false);
  const streaming = ref(false);
  const streamContent = ref('');
  const selectedKbId = ref('all');
  const kbList = ref<any[]>([]);

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  async function fetchConversations() {
    try {
      const res: any = await chatApi.listConversations();
      conversations.value = res.data || res || [];
    } catch {
      conversations.value = [];
    }
  }

  async function fetchKbList() {
    try {
      const res: any = await knowledgeBaseApi.list({ page: 1, limit: 100 });
      const items = res.data || res || [];
      kbList.value = [{ id: 'all', name: '全部知识库' }, ...items.map((kb: any) => ({ id: kb.id, name: kb.name }))];
    } catch {
      kbList.value = [{ id: 'all', name: '全部知识库' }];
    }
  }

  async function loadMessages(convId: string) {
    currentConvId.value = convId;
    loading.value = true;
    try {
      const res: any = await chatApi.getMessages(convId);
      messages.value = res.data || res || [];
    } finally {
      loading.value = false;
    }
  }

  async function sendMessage(content: string) {
    if (!currentConvId.value) {
      // 创建新对话，传入选中的 kbId
      const res: any = await chatApi.createConversation({
        kbId: selectedKbId.value || 'all',
        title: content.slice(0, 20),
      });
      const conv = res.data || res;
      currentConvId.value = conv.id;
      conversations.value.unshift(conv);
    }

    messages.value.push({
      id: Date.now().toString(),
      role: 'user',
      content,
    });

    loading.value = true;
    streaming.value = true;
    streamContent.value = '';

    let citations: any[] = [];

    try {
      const response = await chatApi.sendMessageStream(currentConvId.value, {
        content,
        kbId: selectedKbId.value,
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
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: streamContent.value,
        citations,
      });
    } catch (err: any) {
      messages.value.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，发生了错误：' + (err.message || '未知错误'),
      });
    } finally {
      loading.value = false;
      streaming.value = false;
      streamContent.value = '';
    }
  }

  async function newConversation() {
    currentConvId.value = '';
    messages.value = [];
  }

  async function deleteConversation(convId: string) {
    try {
      await chatApi.deleteConversation(convId);
      conversations.value = conversations.value.filter(c => c.id !== convId);
      if (currentConvId.value === convId) {
        currentConvId.value = '';
        messages.value = [];
      }
    } catch { /* ignore */ }
  }

  return {
    isOpen,
    conversations,
    messages,
    currentConvId,
    loading,
    streaming,
    streamContent,
    selectedKbId,
    kbList,
    toggle,
    open,
    close,
    fetchConversations,
    fetchKbList,
    loadMessages,
    sendMessage,
    newConversation,
    deleteConversation,
  };
});
