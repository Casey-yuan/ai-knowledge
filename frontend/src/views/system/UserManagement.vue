<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">用户管理</div>
        <div class="page-desc">管理系统用户账号、角色分配和访问权限</div>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新建用户
        </el-button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="filter-search">
        <el-icon :size="16"><Search /></el-icon>
        <input v-model="searchText" placeholder="搜索用户..." />
      </div>
      <el-select v-model="filterRole" placeholder="全部角色" clearable style="width: 120px" size="default">
        <el-option label="管理员" value="ADMIN" />
        <el-option label="编辑者" value="EDITOR" />
        <el-option label="查看者" value="VIEWER" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="全部状态" clearable style="width: 120px" size="default">
        <el-option label="正常" value="ACTIVE" />
        <el-option label="已禁用" value="DISABLED" />
      </el-select>
    </div>

    <!-- Table -->
    <el-card shadow="never" style="padding: 0">
      <el-table :data="filteredList" v-loading="loading">
        <el-table-column label="用户">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 10px">
              <div class="user-avatar" :style="{ background: avatarColor(row.nickname || row.phone) }">
                {{ (row.nickname || row.phone || '?').charAt(0) }}
              </div>
              <div>
                <div style="font-weight: 510">{{ row.nickname || row.phone }}</div>
                <div style="font-size: 11px; color: var(--fg-subtle)">ID: {{ row.id?.slice(0, 8) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号">
          <template #default="{ row }">{{ maskPhone(row.phone) }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'ADMIN' ? '' : 'info'" size="small">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'" size="small">
              {{ row.status === 'ACTIVE' ? '正常' : '已禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" text :type="row.status === 'ACTIVE' ? 'warning' : 'success'" @click="handleToggleStatus(row)">
              {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create/Edit User Dialog -->
    <el-dialog v-model="showDialog" :title="editingUser ? '编辑用户' : '新建用户'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="手机号" required>
          <el-input v-model="form.phone" placeholder="请输入手机号" :disabled="!!editingUser" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" type="email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" :required="!editingUser">
          <el-input v-model="form.password" type="password" :placeholder="editingUser ? '留空则不修改' : '请输入初始密码'" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="编辑者" value="EDITOR" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="查看者" value="VIEWER" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" v-if="editingUser">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="正常" value="ACTIVE" />
            <el-option label="已禁用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave">{{ editingUser ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { systemApi } from '@/api/system';

const list = ref<any[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const searchText = ref('');
const filterRole = ref('');
const filterStatus = ref('');
const editingUser = ref<any>(null);
const form = ref({ phone: '', password: '', nickname: '', email: '', role: 'EDITOR', status: 'ACTIVE' });

const avatarColors = [
  'var(--seed-avatar-a)', 'var(--seed-avatar-b)', 'var(--seed-avatar-c)',
];

function avatarColor(name: string) {
  const idx = (name || '').charCodeAt(0) % 3;
  return `linear-gradient(135deg, ${['#4facfe,#00f2fe', '#f093fb,#f5576c', '#a8edea,#fed6e3'][idx]})`;
}

function maskPhone(phone: string) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function roleLabel(role: string) {
  const map: Record<string, string> = { ADMIN: '管理员', EDITOR: '编辑者', VIEWER: '查看者' };
  return map[role] || role;
}

function formatDate(d: string) {
  if (!d) return '';
  return d.slice(0, 10);
}

const filteredList = computed(() => {
  let items = list.value;
  const q = searchText.value.toLowerCase();
  if (q) items = items.filter((u: any) => (u.nickname || '').toLowerCase().includes(q) || (u.phone || '').includes(q));
  if (filterRole.value) items = items.filter((u: any) => u.role === filterRole.value);
  if (filterStatus.value) items = items.filter((u: any) => u.status === filterStatus.value);
  return items;
});

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await systemApi.getUsers();
    list.value = res.data || res || [];
  } finally {
    loading.value = false;
  }
}

function handleCreate() {
  editingUser.value = null;
  form.value = { phone: '', password: '', nickname: '', email: '', role: 'EDITOR', status: 'ACTIVE' };
  showDialog.value = true;
}

function handleEdit(row: any) {
  editingUser.value = row;
  form.value = {
    phone: row.phone || '',
    password: '',
    nickname: row.nickname || '',
    email: row.email || '',
    role: row.role || 'EDITOR',
    status: row.status || 'ACTIVE',
  };
  showDialog.value = true;
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  try {
    await systemApi.updateUser(row.id, { status: newStatus });
    ElMessage.success(newStatus === 'ACTIVE' ? '已启用' : '已禁用');
    await fetchList();
  } catch { /* handled */ }
}

async function handleSave() {
  if (!editingUser.value && (!form.value.phone || !form.value.password)) {
    ElMessage.warning('请填写必填项');
    return;
  }

  try {
    if (editingUser.value) {
      // 编辑模式
      const updateData: any = {
        nickname: form.value.nickname,
        email: form.value.email,
        status: form.value.status,
      };
      if (form.value.password) {
        updateData.password = form.value.password;
      }
      await systemApi.updateUser(editingUser.value.id, updateData);
      ElMessage.success('保存成功');
    } else {
      // 创建模式
      await systemApi.createUser(form.value);
      ElMessage.success('创建成功');
    }
    showDialog.value = false;
    editingUser.value = null;
    form.value = { phone: '', password: '', nickname: '', email: '', role: 'EDITOR', status: 'ACTIVE' };
    await fetchList();
  } catch { /* handled */ }
}

onMounted(fetchList);
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

.filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.filter-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  min-width: 240px;
}
.filter-search:focus-within { border-color: var(--primary); }
.filter-search input {
  border: none; background: transparent; font-size: 13px;
  color: var(--fg); outline: none; width: 100%; font-family: inherit;
}

.user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--white); font-size: 12px; font-weight: 590; flex-shrink: 0;
}
</style>
