import request from './request';

export const chatApi = {
  listConversations: (kbId?: string) =>
    request.get('/conversations', { params: { kbId } }),
  createConversation: (data: { kbId: string; title?: string }) =>
    request.post('/conversations', data),
  getMessages: (id: string) =>
    request.get(`/conversations/${id}/messages`),
  sendMessage: (id: string, data: { content: string }) =>
    request.post(`/conversations/${id}/messages`, data),
  feedback: (id: string, data: { feedback: string }) =>
    request.post(`/messages/${id}/feedback`, data),
  deleteConversation: (id: string) =>
    request.delete(`/conversations/${id}`),
  /**
   * SSE 流式发送消息
   * 返回 ReadableStream，由调用方消费
   */
  sendMessageStream: (id: string, data: { content: string; kbId?: string }) => {
    const token = localStorage.getItem('token');
    return fetch(`/api/conversations/${id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify(data),
    });
  },
};
