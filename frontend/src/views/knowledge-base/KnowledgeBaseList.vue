<template>
  <div>
    <!-- Page Header with Back Button -->
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push('/')" title="返回工作台">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title">知识库管理</div>
          <div class="page-desc">管理所有知识库及其配置</div>
        </div>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="showDialog = true">
          <el-icon><Plus /></el-icon> 新建知识库
        </el-button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stat-grid">
      <div class="stat-card" v-for="item in statsCards" :key="item.label">
        <div class="stat-icon" :style="{ background: item.iconBg, color: item.iconColor }">
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
        </div>
        <div class="stat-value">{{ item.value }}</div>
        <div class="stat-label">{{ item.label }}</div>
      </div>
    </div>

    <!-- Search Bar with Public Toggle -->
    <div class="filter-bar">
      <div class="filter-search">
        <el-icon :size="16"><Search /></el-icon>
        <input v-model="searchText" placeholder="搜索知识库名称..." />
      </div>
      <div class="filter-toggle" @click="showPublicOnly = !showPublicOnly">
        <el-icon :size="14"><View /></el-icon>
        <span>仅看公开</span>
        <div class="toggle-switch" :class="{ active: showPublicOnly }">
          <div class="toggle-knob"></div>
        </div>
      </div>
    </div>

    <!-- KB Card Grid -->
    <div class="kb-grid" v-loading="loading">
      <el-card
        v-for="kb in paginatedList"
        :key="kb.id"
        shadow="never"
        class="kb-card"
        @click="$router.push(`/knowledge-bases/${kb.id}/documents`)"
      >
        <div class="kb-card-header">
          <div class="kb-card-icon" :style="{ background: kb._color?.bg, color: kb._color?.fg }">
            {{ (kb.name || '?').charAt(0) }}
          </div>
          <div class="kb-card-info">
            <div class="kb-card-name">
              {{ kb.name }}
              <el-tag v-if="kb.isPublic" type="success" size="small" style="margin-left: 6px">公开</el-tag>
              <el-tag v-else type="info" size="small" style="margin-left: 6px">私有</el-tag>
            </div>
            <div class="kb-card-desc">{{ kb.description || '暂无描述' }}</div>
          </div>
        </div>
        <div class="kb-card-stats">
          <span class="kb-stat"><strong>{{ kb.documentCount ?? '-' }}</strong> 文档</span>
          <span class="kb-stat"><strong>{{ kb.chunkCount ?? '-' }}</strong> 分块</span>
          <span class="kb-stat"><strong>{{ kb.viewCount ?? 0 }}</strong> 浏览</span>
          <span class="kb-stat kb-stat-time">{{ formatTime(kb.updatedAt) }}</span>
        </div>
        <div class="kb-card-actions" @click.stop>
          <el-button size="small" text type="primary" @click="handleEdit(kb)">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-button size="small" text type="success" @click="$router.push(`/knowledge-bases/${kb.id}/retrieval`)">
            <el-icon><Search /></el-icon> 检索
          </el-button>
          <el-button size="small" text type="danger" @click="handleDelete(kb)">
            <el-icon><Delete /></el-icon> 删除
          </el-button>
        </div>
      </el-card>

      <!-- Add new card -->
      <el-card shadow="never" class="kb-card kb-add-card" @click="showDialog = true">
        <el-icon :size="32" color="var(--fg-subtle)"><Plus /></el-icon>
        <span>新建知识库</span>
      </el-card>
    </div>

    <div class="pagination-wrap" v-if="filteredList.length > 0">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredList.length"
        layout="prev, pager, next, total"
        background
        small
      />
    </div>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDialog" :title="editingId ? '编辑知识库' : '新建知识库'" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="输入知识库名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="简要描述用途" />
        </el-form-item>
        <el-form-item label="可见性">
          <el-switch v-model="form.isPublic" active-text="公开" inactive-text="私有" />
          <span style="margin-left: 12px; font-size: 12px; color: var(--fg-muted)">
            {{ form.isPublic ? '所有人可见' : '仅自己可见' }}
          </span>
        </el-form-item>
        <el-form-item label="Top-K">
          <el-input-number v-model="form.topK" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="相似度阈值">
          <el-slider v-model="form.similarityThreshold" :min="0" :max="1" :step="0.05" style="width: 200px" />
          <span style="margin-left: 12px; color: var(--fg-muted)">{{ form.similarityThreshold }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { knowledgeBaseApi } from '@/api/knowledgeBase';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const list = ref<any[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const saving = ref(false);
const editingId = ref('');
const searchText = ref('');
const showPublicOnly = ref(false);
const currentPage = ref(1);
const pageSize = 10;
const form = ref({ name: '', description: '', isPublic: true, topK: 5, similarityThreshold: 0.3 });

const colorPalette = [
  { bg: 'var(--primary-light)', fg: 'var(--primary)' },
  { bg: 'var(--success-light)', fg: 'var(--success)' },
  { bg: 'var(--warn-light)', fg: 'var(--warn)' },
  { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  { bg: 'var(--kb-purple-bg)', fg: 'var(--kb-purple)' },
];

// Stats cards computed from list data
const statsCards = computed(() => {
  const all = list.value;
  let totalDocs = 0, totalChunks = 0, publicKbs = 0;
  all.forEach((kb: any) => {
    totalDocs += kb.documentCount || 0;
    totalChunks += kb.chunkCount || 0;
    if (kb.isPublic) publicKbs++;
  });
  return [
    { label: '知识库', value: all.length, icon: 'FolderOpened', iconBg: 'var(--primary-light)', iconColor: 'var(--primary)' },
    { label: '文档总数', value: totalDocs, icon: 'Document', iconBg: 'var(--success-light)', iconColor: 'var(--success)' },
    { label: '知识分块', value: totalChunks, icon: 'Collection', iconBg: 'var(--warn-light)', iconColor: 'var(--warn)' },
    { label: '公开知识库', value: publicKbs, icon: 'View', iconBg: 'var(--danger-light)', iconColor: 'var(--danger)' },
  ];
});

const filteredList = computed(() => {
  let items = list.value;
  
  // Filter by public toggle
  if (showPublicOnly.value) {
    items = items.filter(kb => kb.isPublic);
  }
  
  // Filter by search text
  const q = searchText.value.toLowerCase();
  if (q) {
    items = items.filter((kb: any) => kb.name?.toLowerCase().includes(q));
  }
  
  return items.map((kb: any, i: number) => ({
    ...kb,
    _color: colorPalette[i % colorPalette.length],
  }));
});

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredList.value.slice(start, start + pageSize);
});

watch([searchText, showPublicOnly], () => {
  currentPage.value = 1;
});

function formatTime(t: string) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

async function fetchList() {
  loading.value = true;
  try {
    const res: any = await knowledgeBaseApi.list();
    list.value = res.data || res || [];
  } finally {
    loading.value = false;
  }
}

function handleEdit(row: any) {
  editingId.value = row.id;
  form.value = { 
    name: row.name, 
    description: row.description || '', 
    isPublic: row.isPublic ?? true,
    topK: row.topK || 5, 
    similarityThreshold: row.similarityThreshold || 0.3 
  };
  showDialog.value = true;
}

async function handleSave() {
  if (!form.value.name) { ElMessage.warning('请输入名称'); return; }
  saving.value = true;
  try {
    if (editingId.value) {
      await knowledgeBaseApi.update(editingId.value, form.value);
      ElMessage.success('更新成功');
    } else {
      await knowledgeBaseApi.create(form.value);
      ElMessage.success('创建成功');
    }
    showDialog.value = false;
    editingId.value = '';
    form.value = { name: '', description: '', isPublic: true, topK: 5, similarityThreshold: 0.3 };
    await fetchList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm('确认删除该知识库？');
  await knowledgeBaseApi.remove(row.id);
  ElMessage.success('删除成功');
  await fetchList();
}

onMounted(fetchList);
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-btn {
  width: 36px; height: 36px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--surface);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s; color: var(--fg-muted); flex-shrink: 0;
}
.back-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

/* Stats Grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 0.2s;
}
.stat-card:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); }
.stat-icon {
  width: 40px; height: 40px; border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
}
.stat-value { font-size: 28px; font-weight: 590; letter-spacing: -0.02em; line-height: 1.1; }
.stat-label { font-size: 12.5px; color: var(--fg-muted); margin-top: 4px; }

/* Filter Bar */
.filter-bar { display: flex; gap: 16px; margin-bottom: 16px; align-items: center; }
.filter-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  min-width: 240px; transition: border-color 0.15s;
}
.filter-search:focus-within { border-color: var(--primary); }
.filter-search input {
  border: none; background: transparent; font-size: 13px;
  color: var(--fg); outline: none; width: 100%; font-family: inherit;
}
.filter-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  font-size: 13px; color: var(--fg-muted);
  cursor: pointer; transition: all 0.15s; user-select: none;
}
.filter-toggle:hover { border-color: var(--primary); color: var(--fg); }
.toggle-switch {
  width: 32px; height: 18px; border-radius: 9px;
  background: var(--border); position: relative;
  transition: background 0.2s; margin-left: 4px;
}
.toggle-switch.active { background: var(--primary); }
.toggle-knob {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--white); position: absolute;
  top: 2px; left: 2px; transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.toggle-switch.active .toggle-knob { transform: translateX(14px); }

/* KB Grid */
.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.kb-card { cursor: pointer; transition: all 0.2s; }
.kb-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
.kb-card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.kb-card-icon {
  width: 40px; height: 40px; border-radius: var(--radius);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 590;
}
.kb-card-name { font-size: 15px; font-weight: 590; letter-spacing: -0.01em; display: flex; align-items: center; }
.kb-card-desc {
  font-size: 12.5px; color: var(--fg-muted); margin-top: 4px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.kb-card-stats {
  display: flex; gap: 16px; margin-top: 14px; padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}
.kb-stat { font-size: 12px; color: var(--fg-muted); }
.kb-stat strong { color: var(--fg); font-weight: 510; }
.kb-stat-time { margin-left: auto; font-size: 11px; }
.kb-card-actions {
  display: flex; gap: 4px; margin-top: 12px; padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}
.kb-add-card {
  border-style: dashed;
  display: flex; align-items: center; justify-content: center;
  min-height: 180px; flex-direction: column; gap: 8px;
  cursor: pointer;
}
.kb-add-card:hover { border-color: var(--primary); }
.kb-add-card span { font-size: 13px; color: var(--fg-muted); }

@media (max-width: 1200px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
.pagination-wrap { display: flex; justify-content: center; margin-top: 20px; }
</style>
