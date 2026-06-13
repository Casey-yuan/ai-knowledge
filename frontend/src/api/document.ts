import request from './request';

export const documentApi = {
  list: (kbId: string, params?: any) =>
    request.get(`/knowledge-bases/${kbId}/documents`, { params }),
  get: (id: string) => request.get(`/documents/${id}`),
  getContent: (id: string) => request.get(`/documents/${id}/content`),
  getHot: (params?: { page?: number; limit?: number } | number) => {
    if (typeof params === 'number') return request.get('/documents/hot', { params: { limit: params } });
    return request.get('/documents/hot', { params });
  },
  getRecent: (limit?: number) => request.get('/documents/recent', { params: { limit } }),
  search: (query: string, limit?: number) => 
    request.get('/documents/search', { params: { q: query, limit } }),
  upload: (kbId: string, formData: FormData) =>
    request.post(`/knowledge-bases/${kbId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createMarkdown: (kbId: string, data: { title: string; content?: string; isPublic?: boolean }) =>
    request.post(`/knowledge-bases/${kbId}/documents/markdown`, data),
  updateContent: (id: string, data: { title?: string; content?: string; isPublic?: boolean }) =>
    request.put(`/documents/${id}/content`, data),
  publish: (id: string) => request.post(`/documents/${id}/publish`),
  remove: (id: string) => request.delete(`/documents/${id}`),
  reindex: (id: string) => request.post(`/documents/${id}/reindex`),
};
