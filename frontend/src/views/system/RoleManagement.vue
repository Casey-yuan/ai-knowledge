<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">角色管理</div>
        <div class="page-desc">定义系统角色并配置对应的操作权限</div>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="ElMessage.info('角色创建功能开发中')">
          <el-icon><Plus /></el-icon> 新建角色
        </el-button>
      </div>
    </div>

    <div class="roles-layout">
      <!-- Role List -->
      <el-card shadow="never">
        <template #header><span class="card-title">角色列表</span></template>
        <div class="role-list">
          <div
            v-for="role in roles"
            :key="role.key"
            class="role-item"
            :class="{ active: selectedRole === role.key }"
            @click="selectedRole = role.key"
          >
            <div class="role-name" :style="selectedRole === role.key ? { color: 'var(--primary)' } : {}">{{ role.label }}</div>
            <div class="role-desc">{{ role.desc }}</div>
          </div>
        </div>
      </el-card>

      <!-- Permission Matrix -->
      <el-card shadow="never">
        <template #header>
          <span class="card-title">权限矩阵 — {{ currentRoleLabel }}</span>
        </template>
        <el-table :data="permMatrix" size="small" border>
          <el-table-column prop="module" label="功能模块" width="120">
            <template #default="{ row }">
              <span style="font-weight: 510">{{ row.module }}</span>
            </template>
          </el-table-column>
          <el-table-column v-for="perm in permissions" :key="perm.key" :label="perm.label" width="70" align="center">
            <template #default="{ row }">
              <el-icon v-if="row[perm.key]" color="var(--primary)" :size="16"><Select /></el-icon>
              <span v-else style="color: var(--fg-subtle)">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { systemApi } from '@/api/system';

const selectedRole = ref('admin');
const roles = [
  { key: 'admin', label: '管理员', desc: '拥有系统所有权限 · 1 人' },
  { key: 'editor', label: '编辑者', desc: '知识库与文档的增删改权限 · 2 人' },
  { key: 'viewer', label: '查看者', desc: '只读权限，可查看知识库和对话 · 1 人' },
];

const permissions = [
  { key: 'view', label: '查看' },
  { key: 'create', label: '创建' },
  { key: 'edit', label: '编辑' },
  { key: 'delete', label: '删除' },
  { key: 'manage', label: '管理' },
];

const permData: Record<string, any[]> = {
  admin: [
    { module: '知识库', view: true, create: true, edit: true, delete: true, manage: true },
    { module: '文档', view: true, create: true, edit: true, delete: true, manage: true },
    { module: '对话', view: true, create: true, edit: false, delete: true, manage: true },
    { module: '用户管理', view: true, create: true, edit: true, delete: true, manage: true },
    { module: '系统设置', view: true, create: false, edit: true, delete: false, manage: true },
  ],
  editor: [
    { module: '知识库', view: true, create: false, edit: false, delete: false, manage: false },
    { module: '文档', view: true, create: true, edit: true, delete: true, manage: false },
    { module: '对话', view: true, create: true, edit: false, delete: false, manage: false },
    { module: '用户管理', view: false, create: false, edit: false, delete: false, manage: false },
    { module: '系统设置', view: false, create: false, edit: false, delete: false, manage: false },
  ],
  viewer: [
    { module: '知识库', view: true, create: false, edit: false, delete: false, manage: false },
    { module: '文档', view: true, create: false, edit: false, delete: false, manage: false },
    { module: '对话', view: true, create: true, edit: false, delete: false, manage: false },
    { module: '用户管理', view: false, create: false, edit: false, delete: false, manage: false },
    { module: '系统设置', view: false, create: false, edit: false, delete: false, manage: false },
  ],
};

const permMatrix = computed(() => permData[selectedRole.value] || permData.admin);
const currentRoleLabel = computed(() => roles.find(r => r.key === selectedRole.value)?.label || '管理员');

onMounted(async () => {
  try {
    const res: any = await systemApi.getRoles();
    // Could merge server roles with local definitions
  } catch { /* use local roles */ }
});
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }
.card-title { font-size: 15px; font-weight: 590; }

.roles-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.role-list { display: flex; flex-direction: column; gap: 8px; }
.role-item {
  padding: 12px; border: 1px solid var(--border); border-radius: var(--radius);
  cursor: pointer; transition: all 0.15s;
}
.role-item:hover { border-color: var(--primary); }
.role-item.active { border-color: var(--primary); background: var(--primary-light); }
.role-name { font-weight: 510; font-size: 14px; }
.role-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
</style>
