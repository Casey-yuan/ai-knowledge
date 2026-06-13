<template>
  <div>
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push(`/knowledge-bases/${route.params.kbId}/documents`)" title="返回文档列表">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title-row">
            <h3 class="page-title">{{ doc?.title }}</h3>
            <el-tag :type="doc?.type === 'MARKDOWN' ? 'success' : 'warning'" size="small">
              {{ doc?.type === 'MARKDOWN' ? 'Markdown' : '文件' }}
            </el-tag>
            <el-tag :type="doc?.isPublic ? 'success' : 'info'" size="small">
              {{ doc?.isPublic ? '公开' : '私有' }}
            </el-tag>
            <el-tag :type="statusType(doc?.status)" size="small">{{ statusLabel(doc?.status) }}</el-tag>
          </div>
          <div class="doc-meta">
            <span class="meta-item">版本: {{ doc?.version }}</span>
            <span class="meta-item">大小: {{ doc?.fileSize ? formatSize(doc.fileSize) : '-' }}</span>
            <span class="meta-item">分块: {{ doc?.chunks?.length || 0 }}</span>
            <span class="meta-item">浏览: {{ doc?.viewCount || 0 }}</span>
          </div>
        </div>
      </div>
      <div class="page-actions">
        <el-button size="small" v-if="doc?.type === 'MARKDOWN'" @click="$router.push(`/knowledge-bases/${route.params.kbId}/documents/${doc?.id}/edit`)">
          <el-icon><Edit /></el-icon> 编辑
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="doc-content-card">
      <template #header>
        <span class="card-title">文档内容</span>
      </template>
      <div v-if="renderedContent" class="markdown-body" v-html="renderedContent"></div>
      <el-empty v-else description="暂无内容" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { documentApi } from '@/api/document';
import { marked } from 'marked';

const route = useRoute();
const doc = ref<any>(null);
const content = ref('');

// Configure marked for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderedContent = computed(() => {
  if (!content.value) return '';
  
  // Always try to render as markdown for MARKDOWN type
  if (doc.value?.type === 'MARKDOWN' || /[#*`\[\]>~_|]/.test(content.value)) {
    try {
      return marked(content.value) as string;
    } catch {
      return `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(content.value)}</pre>`;
    }
  }
  
  // For plain text, preserve formatting
  return `<pre style="white-space: pre-wrap; font-family: inherit; line-height: 1.6;">${escapeHtml(content.value)}</pre>`;
});

function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusType(status: string) {
  const map: Record<string, string> = {
    'COMPLETED': 'success', 'EMBEDDING': '', 'CHUNKING': 'warning', 'FAILED': 'danger',
  };
  return map[status] || 'info';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    'COMPLETED': '已完成', 'EMBEDDING': '索引中', 'CHUNKING': '分块中', 'PARSING': '解析中', 'FAILED': '失败', 'PENDING': '待处理',
  };
  return map[status] || status;
}

onMounted(async () => {
  const [docRes, contentRes]: any = await Promise.all([
    documentApi.get(route.params.id as string),
    documentApi.getContent(route.params.id as string),
  ]);
  doc.value = docRes.data || docRes;
  content.value = contentRes.data?.content || contentRes?.content || '';
});
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
.page-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 590; margin: 0; letter-spacing: -0.02em; }
.doc-meta { display: flex; gap: 14px; margin-top: 4px; }
.meta-item { font-size: 12px; color: var(--fg-muted); }
.page-actions { display: flex; gap: 8px; flex-shrink: 0; }

.doc-content-card {
  margin-top: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 590;
}

/* Markdown body styling */
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--fg);
}
.markdown-body :deep(h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 24px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.markdown-body :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 20px 0 12px;
}
.markdown-body :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 16px 0 8px;
}
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0 8px;
}
.markdown-body :deep(p) {
  margin: 12px 0;
}
.markdown-body :deep(code) {
  background: var(--bg2);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
.markdown-body :deep(pre) {
  background: var(--bg2);
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid var(--primary);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--fg-muted);
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 12px 0;
}
.markdown-body :deep(li) {
  margin: 4px 0;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}
.markdown-body :deep(th) {
  background: var(--bg2);
  font-weight: 600;
}
.markdown-body :deep(a) {
  color: var(--primary);
  text-decoration: none;
}
.markdown-body :deep(a:hover) {
  text-decoration: underline;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 12px 0;
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}
</style>
