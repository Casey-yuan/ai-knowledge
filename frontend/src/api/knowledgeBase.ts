import request from './request';

export const knowledgeBaseApi = {
  list: (params?: any) => request.get('/knowledge-bases', { params }),
  get: (id: string) => request.get(`/knowledge-bases/${id}`),
  getHot: (params?: { page?: number; limit?: number } | number) => {
    if (typeof params === 'number') return request.get('/knowledge-bases/hot', { params: { limit: params } });
    return request.get('/knowledge-bases/hot', { params });
  },
  create: (data: any) => request.post('/knowledge-bases', data),
  update: (id: string, data: any) => request.patch(`/knowledge-bases/${id}`, data),
  remove: (id: string) => request.delete(`/knowledge-bases/${id}`),
  testRetrieval: (id: string, data: any) =>
    request.post(`/knowledge-bases/${id}/test-retrieval`, data),
};
