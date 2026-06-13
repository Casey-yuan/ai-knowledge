<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push('/knowledge-bases')" title="返回知识库">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title-row">
            <span class="page-title">{{ kbName }}</span>
            <el-tag v-if="kb?.isPublic" type="success" size="small">公开</el-tag>
            <el-tag v-else type="info" size="small">私有</el-tag>
          </div>
          <div class="page-desc">{{ kb?.description || '暂无描述' }}</div>
        </div>
      </div>
      <div class="page-actions">
        <el-button @click="showNewDialog = true">
          <el-icon><EditPen /></el-icon> 新建文档
        </el-button>
        <el-upload
          :action="`/api/knowledge-bases/${kbId}/documents`"
          :headers="uploadHeaders"
          :show-file-list="false"
          :multiple="true"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
        >
          <el-button type="primary">
            <el-icon><Upload /></el-icon> 上传文件
          </el-button>
        </el-upload>
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stats-item">
        <span class="stats-value">{{ total }}</span>
        <span class="stats-label">文档</span>
      </div>
      <div class="stats-divider"></div>
      <div class="stats-item">
        <span class="stats-value">{{ totalChunks }}</span>
        <span class="stats-label">分块</span>
      </div>
      <div class="stats-divider"></div>
      <div class="stats-item">
        <span class="stats-value">{{ completedCount }}</span>
        <span class="stats-label">已完成</span>
      </div>
      <div class="stats-divider"></div>
      <div class="stats-item">
        <span class="stats-value">{{ processingCount }}</span>
        <span class="stats-label">处理中</span>
      </div>
    </div>

    <!-- Document List -->
    <div class="doc-list" v-loading="loading">
      <div
        v-for="doc in list"
        :key="doc.id"
        class="doc-row"
        @click="$router.push(`/knowledge-bases/${kbId}/documents/${doc.id}`)"
      >
        <div class="doc-type-icon" :class="doc.type === 'MARKDOWN' ? 'md' : 'file'">
          {{ doc.type === 'MARKDOWN' ? 'MD' : 'F' }}
        </div>
        <div class="doc-main">
          <div class="doc-title-row">
            <span class="doc-title">{{ doc.title }}</span>
            <el-tag :type="doc.isPublic ? 'success' : 'info'" size="small">{{ doc.isPublic ? '公开' : '私有' }}</el-tag>
          </div>
          <div class="doc-meta">
            <el-tag :type="statusMap[doc.status]?.type || 'info'" size="small" effect="plain">{{ statusMap[doc.status]?.label || doc.status }}</el-tag>
            <span><el-icon><Collection /></el-icon> {{ doc.chunkCount || 0 }} 分块</span>
            <span v-if="doc.fileSize"><el-icon><Coin /></el-icon> {{ formatSize(doc.fileSize) }}</span>
            <span>v{{ doc.version }}</span>
            <span>{{ formatTime(doc.updatedAt) }}</span>
          </div>
        </div>
        <div class="doc-actions" @click.stop>
          <el-button v-if="doc.type === 'MARKDOWN'" size="small" text type="primary" @click="$router.push(`/knowledge-bases/${kbId}/documents/${doc.id}/edit`)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button size="small" text type="primary" @click="$router.push(`/knowledge-bases/${kbId}/documents/${doc.id}`)">
            <el-icon><View /></el-icon>
          </el-button>
          <el-button v-if="doc.status !== 'COMPLETED'" size="small" text type="warning" @click="handleReindex(doc)">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
          <el-button size="small" text type="danger" @click="handleDelete(doc)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <el-empty v-if="!loading && !list.length" description="暂无文档，点击上方按钮创建或上传" :image-size="100" />
    </div>

    <div class="pagination-wrap" v-if="total > 0">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        background
        small
      />
    </div>

    <!-- Create Markdown Dialog -->
    <el-dialog v-model="showNewDialog" title="新建 Markdown 文档" width="500px">
      <el-form :model="newDoc" label-width="80px">
        <el-form-item label="标题" :required="true">
          <el-input v-model="newDoc.title" placeholder="文档标题" />
        </el-form-item>
        <el-form-item label="可见性">
          <el-switch v-model="newDoc.isPublic" active-text="公开" inactive-text="私有" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateDoc">创建并编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { documentApi } from '@/api/document';
import { knowledgeBaseApi } from '@/api/knowledgeBase';

const route = useRoute();
const router = useRouter();

const list = ref<any[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = 10;
const total = ref(0);
const kbName = ref('');
const kb = ref<any>(null);
const showNewDialog = ref(false);
const newDoc = ref({ title: '', isPublic: true });
const kbId = route.params.kbId as string;
const uploadHeaders = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };

const statusMap: Record<string, { label: string; type: string }> = {
  PENDING: { label: '待处理', type: 'info' },
  PARSING: { label: '解析中', type: 'warning' },
  CHUNKING: { label: '分块中', type: 'warning' },
  EMBEDDING: { label: '索引中', type: '' },
  COMPLETED: { label: '已完成', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
};

// Stats computed from current page data (for display; total from server)
const totalChunks = computed(() => list.value.reduce((s, d) => s + (d.chunkCount || 0), 0));
const completedCount = computed(() => list.value.filter(d => d.status === 'COMPLETED').length);
const processingCount = computed(() => list.value.filter(d => !['COMPLETED', 'FAILED'].includes(d.status)).length);

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(t: string) {
  if (!t) return '';
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

async function fetchData() {
  loading.value = true;
  try {
    const kbRes: any = await knowledgeBaseApi.get(kbId);
    kb.value = kbRes.data || kbRes;
    kbName.value = kb.value?.name || '';
    newDoc.value.isPublic = kb.value?.isPublic ?? true;
    
    const docRes: any = await documentApi.list(kbId, { page: currentPage.value, limit: pageSize });
    list.value = docRes.data || docRes;
    total.value = docRes.total || list.value.length;
  } finally {
    loading.value = false;
  }
}

// Watch page changes to re-fetch
watch(() => currentPage.value, () => { fetchData(); });

function handleUploadSuccess() {
  ElMessage.success('上传成功');
  fetchData();
}

function handleUploadError() {
  ElMessage.error('上传失败');
}

async function handleCreateDoc() {
  if (!newDoc.value.title) { ElMessage.warning('请输入标题'); return; }
  const res: any = await documentApi.createMarkdown(kbId, newDoc.value);
  showNewDialog.value = false;
  newDoc.value = { title: '', isPublic: kb.value?.isPublic ?? true };
  router.push(`/knowledge-bases/${kbId}/documents/${res.data?.id || res.id}/edit`);
}

async function handleReindex(row: any) {
  await documentApi.reindex(row.id);
  ElMessage.success('已触发重建');
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm('确认删除该文档？');
  await documentApi.remove(row.id);
  ElMessage.success('删除成功');
  await fetchData();
}

onMounted(fetchData);
</script>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;
}
.page-header-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.back-btn {
  width: 36px; height: 36px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--surface);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s; color: var(--fg-muted); flex-shrink: 0;
}
.back-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
.page-title-row { display: flex; align-items: center; gap: 8px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }
.page-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* Stats Bar */
.stats-bar {
  display: flex; align-items: center; gap: 20px;
  padding: 14px 20px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  margin-bottom: 16px;
}
.stats-item { display: flex; align-items: baseline; gap: 6px; }
.stats-value { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.stats-label { font-size: 12px; color: var(--fg-muted); }
.stats-divider { width: 1px; height: 24px; background: var(--border); }

/* Document List */
.doc-list { display: flex; flex-direction: column; gap: 6px; }
.doc-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  cursor: pointer; transition: all 0.2s;
}
.doc-row:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
.doc-type-icon {
  width: 40px; height: 40px; border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
  letter-spacing: 0.03em;
}
.doc-type-icon.md { background: var(--success-light); color: var(--success); }
.doc-type-icon.file { background: var(--warn-light); color: var(--warn); }
.doc-main { flex: 1; min-width: 0; }
.doc-title-row { display: flex; align-items: center; gap: 8px; }
.doc-title {
  font-size: 14px; font-weight: 510; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.doc-meta {
  display: flex; align-items: center; gap: 14px; margin-top: 6px;
  font-size: 12px; color: var(--fg-muted);
}
.doc-meta span { display: flex; align-items: center; gap: 3px; }
.doc-actions { display: flex; gap: 2px; flex-shrink: 0; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 20px; }
</style>
