import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'Dashboard', component: () => import('@/views/dashboard/Dashboard.vue') },
      { path: 'explore', name: 'Explore', component: () => import('@/views/explore/ExplorePage.vue') },
      { path: 'knowledge-bases', name: 'KnowledgeBases', component: () => import('@/views/knowledge-base/KnowledgeBaseList.vue') },
      { path: 'knowledge-bases/:id', name: 'KnowledgeBaseDetail', component: () => import('@/views/knowledge-base/KnowledgeBaseDetail.vue') },
      { path: 'knowledge-bases/:id/retrieval', name: 'RetrievalTest', component: () => import('@/views/knowledge-base/RetrievalTestPage.vue') },
      { path: 'knowledge-bases/:kbId/documents', name: 'Documents', component: () => import('@/views/document/DocumentList.vue') },
      { path: 'knowledge-bases/:kbId/documents/:id/edit', name: 'DocumentEdit', component: () => import('@/views/document/DocumentEditor.vue') },
      { path: 'knowledge-bases/:kbId/documents/:id', name: 'DocumentDetail', component: () => import('@/views/document/DocumentDetail.vue') },
      { path: 'settings', name: 'Settings', component: () => import('@/views/system/SystemSettings.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/');
  } else {
    next();
  }
});

export default router;
