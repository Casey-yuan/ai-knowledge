<template>
  <Teleport to="body">
    <Transition name="admin-fade">
      <div v-if="admin.isOpen" class="admin-overlay" @keydown.esc="admin.close()">
        <div class="admin-top">
          <div class="admin-top-title">
            <el-icon :size="18"><Shield /></el-icon>
            系统管理
          </div>
          <button class="admin-top-close" @click="admin.close()">
            <el-icon :size="16"><Close /></el-icon>
          </button>
        </div>
        <div class="admin-body">
          <div class="admin-side">
            <div
              v-for="tab in tabs"
              :key="tab.key"
              class="admin-nav-item"
              :class="{ active: admin.activeTab === tab.key }"
              @click="admin.switchTab(tab.key)"
            >
              <el-icon :size="18"><component :is="tab.icon" /></el-icon>
              {{ tab.label }}
            </div>
          </div>
          <div class="admin-content">
            <UserManagement v-if="admin.activeTab === 'users'" />
            <RoleManagement v-else-if="admin.activeTab === 'roles'" />
            <SystemSettings v-else-if="admin.activeTab === 'settings'" />
            <AuditLogs v-else-if="admin.activeTab === 'logs'" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useAdminStore } from '@/stores/admin';
import UserManagement from '@/views/system/UserManagement.vue';
import RoleManagement from '@/views/system/RoleManagement.vue';
import SystemSettings from '@/views/system/SystemSettings.vue';
import AuditLogs from '@/views/system/AuditLogs.vue';

const admin = useAdminStore();

const tabs = [
  { key: 'users', label: '用户管理', icon: 'User' },
  { key: 'roles', label: '角色管理', icon: 'Lock' },
  { key: 'settings', label: '系统设置', icon: 'Setting' },
  { key: 'logs', label: '审计日志', icon: 'Document' },
];
</script>

<style scoped>
.admin-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--admin-bg);
  display: flex;
  flex-direction: column;
}

.admin-top {
  height: 56px;
  background: var(--admin-nav-bg);
  border-bottom: 1px solid var(--admin-border);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 16px;
  flex-shrink: 0;
}

.admin-top-title {
  font-size: 15px;
  font-weight: 590;
  color: var(--fg);
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-top-close {
  width: 34px;
  height: 34px;
  border-radius: var(--radius);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-muted);
  transition: all 0.15s;
  margin-left: auto;
}
.admin-top-close:hover {
  background: var(--surface-hover);
  color: var(--danger);
  border-color: var(--danger);
}

.admin-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.admin-side {
  width: 200px;
  border-right: 1px solid var(--admin-border);
  background: var(--admin-nav-bg);
  padding: 16px 8px;
  overflow-y: auto;
  flex-shrink: 0;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius);
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13.5px;
  font-weight: 450;
  margin-bottom: 2px;
}
.admin-nav-item:hover {
  background: var(--surface-hover);
  color: var(--fg);
}
.admin-nav-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 510;
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* Transition */
.admin-fade-enter-active,
.admin-fade-leave-active {
  transition: opacity 0.2s ease;
}
.admin-fade-enter-from,
.admin-fade-leave-to {
  opacity: 0;
}
</style>
