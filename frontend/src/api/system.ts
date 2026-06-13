import request from './request';

export const systemApi = {
  getUsers: (params?: any) => request.get('/users', { params }),
  createUser: (data: any) => request.post('/users', data),
  updateUser: (id: string, data: any) => request.patch(`/users/${id}`, data),
  getRoles: () => request.get('/roles'),
  createRole: (data: any) => request.post('/roles', data),
  getSettings: () => request.get('/system/settings'),
  updateSettings: (data: any) => request.put('/system/settings', data),
  getAuditLogs: (params?: any) => request.get('/system/audit-logs', { params }),
  getStats: () => request.get('/system/stats'),
};
