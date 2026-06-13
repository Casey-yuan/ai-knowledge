import request from './request';

export const authApi = {
  login: (data: { username: string; password: string }) =>
    request.post('/auth/login', data),

  phoneLogin: (data: { phone: string; code: string }) =>
    request.post('/auth/phone-login', data),

  getProfile: () => request.get('/auth/profile'),

  sendSms: (data: { phone: string }) =>
    request.post('/sms/send', data),

  refresh: () => request.post('/auth/refresh'),

  logout: () => request.post('/auth/logout'),

  register: (data: { username: string; password: string; nickname?: string; phone?: string }) =>
    request.post('/auth/register', data),

  bindPhone: (data: { phone: string; code: string }) =>
    request.post('/auth/bind-phone', data),
};
