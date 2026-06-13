<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">审计日志</div>
        <div class="page-desc">记录系统操作历史，支持合规审查和问题追溯</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="filter-search">
        <el-icon :size="16"><Search /></el-icon>
        <input v-model="searchText" placeholder="搜索日志..." @keydown.enter="handleSearch" />
      </div>
      <el-select v-model="filterAction" placeholder="全部操作" clearable style="width: 120px" @change="fetchLogs">
        <el-option label="登录" value="LOGIN" />
        <el-option label="创建" value="CREATE" />
        <el-option label="更新" value="UPDATE" />
        <el-option label="删除" value="DELETE" />
      </el-select>
      <el-select v-model="filterResource" placeholder="全部资源" clearable style="width: 120px" @change="fetchLogs">
        <el-option label="知识库" value="KB" />
        <el-option label="文档" value="DOC" />
        <el-option label="用户" value="USER" />
        <el-option label="系统设置" value="SETTINGS" />
      </el-select>
      <el-date-picker
        v-model="filterDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px"
        size="default"
        @change="fetchLogs"
      />
    </div>

    <!-- Table -->
    <el-card shadow="never" style="padding: 0">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="createdAt" label="时间" width="170">
          <template #default="{ row }">
            <span style="white-space: nowrap">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="user" label="用户" width="100">
          <template #default="{ row }">{{ row.userName || row.userId?.slice(0, 8) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="action" label="操作" width="90">
          <template #default="{ row }">
            <el-tag :type="actionType(row.action)" size="small">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="resource" label="资源" width="100">
          <template #default="{ row }">{{ resourceLabel(row.resource) }}</template>
        </el-table-column>
        <el-table-column prop="resourceId" label="资源 ID" width="180">
          <template #default="{ row }">{{ row.resourceId?.slice(0, 16) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="IP 地址" width="140" />
        <el-table-column label="详情">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="showDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination" v-if="total > 0">
        <span class="pagination-info">显示 {{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, total) }} / 共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="sizes, prev, pager, next"
          @current-change="fetchLogs"
          @size-change="fetchLogs"
        />
      </div>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog v-model="detailVisible" title="日志详情" width="500px">
      <div v-if="detailRow" class="detail-body">
        <div class="detail-item">
          <span class="detail-label">时间</span>
          <span class="detail-value">{{ formatTime(detailRow.createdAt) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">用户</span>
          <span class="detail-value">{{ detailRow.userName || detailRow.userId || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">操作</span>
          <span class="detail-value">{{ actionLabel(detailRow.action) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">资源</span>
          <span class="detail-value">{{ resourceLabel(detailRow.resource) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">资源 ID</span>
          <span class="detail-value">{{ detailRow.resourceId || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">IP 地址</span>
          <span class="detail-value">{{ detailRow.ip || '-' }}</span>
        </div>
        <div class="detail-item" v-if="detailRow.details">
          <span class="detail-label">详情</span>
          <pre class="detail-value detail-pre">{{ detailRow.details }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { systemApi } from '@/api/system';

interface AuditLog {
  id: string;
  createdAt: string;
  userId?: string;
  userName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  details?: string;
}

const list = ref<AuditLog[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const searchText = ref('');
const filterAction = ref('');
const filterResource = ref('');
const filterDateRange = ref<[string, string] | null>(null);

const detailVisible = ref(false);
const detailRow = ref<AuditLog | null>(null);

function actionType(action: string) {
  const map: Record<string, string> = { LOGIN: 'success', CREATE: '', UPDATE: 'warning', DELETE: 'danger' };
  return map[action] || 'info';
}
function actionLabel(action: string) {
  const map: Record<string, string> = { LOGIN: '登录', CREATE: '创建', UPDATE: '更新', DELETE: '删除' };
  return map[action] || action;
}
function resourceLabel(resource: string) {
  const map: Record<string, string> = { KB: '知识库', DOC: '文档', USER: '用户', SETTINGS: '系统设置', CONV: '对话' };
  return map[resource] || resource || '-';
}
function formatTime(t: string) {
  if (!t) return '-';
  return t.replace('T', ' ').slice(0, 16);
}

function showDetail(row: AuditLog) {
  detailRow.value = row;
  detailVisible.value = true;
}

function handleSearch() {
  page.value = 1;
  fetchLogs();
}

async function fetchLogs() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: page.value,
      limit: pageSize.value,
    };
    if (filterAction.value) params.action = filterAction.value;
    if (filterResource.value) params.resource = filterResource.value;
    if (filterDateRange.value && filterDateRange.value[0]) {
      params.dateFrom = filterDateRange.value[0];
      params.dateTo = filterDateRange.value[1];
    }
    if (searchText.value) params.keyword = searchText.value;

    const res: any = await systemApi.getAuditLogs(params);
    const data = res.data || res;
    list.value = data.items || data.list || data || [];
    total.value = data.total || list.value.length;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchLogs);
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

.filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.filter-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  min-width: 200px;
}
.filter-search:focus-within { border-color: var(--primary); }
.filter-search input {
  border: none; background: transparent; font-size: 13px;
  color: var(--fg); outline: none; width: 100%; font-family: inherit;
}

.pagination {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 16px; padding: 12px 0 0; border-top: 1px solid var(--border);
}
.pagination-info { font-size: 12.5px; color: var(--fg-muted); }

.detail-body { display: flex; flex-direction: column; gap: 12px; }
.detail-item { display: flex; align-items: baseline; gap: 12px; }
.detail-label { font-size: 13px; color: var(--fg-muted); width: 70px; flex-shrink: 0; }
.detail-value { font-size: 14px; color: var(--fg); flex: 1; }
.detail-pre {
  background: var(--surface); padding: 8px 12px; border-radius: var(--radius);
  font-size: 12px; overflow-x: auto; white-space: pre-wrap;
}
</style>
