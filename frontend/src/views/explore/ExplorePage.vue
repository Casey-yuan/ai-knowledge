<template>
  <div>
    <!-- Page Header with Back Button -->
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push('/')" title="返回工作台">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title">公开知识库</div>
          <div class="page-desc">浏览所有公开的知识库与文档</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="explore-tabs">
      <span class="explore-tab" :class="{ active: activeTab === 'kb' }" @click="activeTab = 'kb'">
        <el-icon><FolderOpened /></el-icon> 知识库
      </span>
      <span class="explore-tab" :class="{ active: activeTab === 'doc' }" @click="activeTab = 'doc'">
        <el-icon><Document /></el-icon> 文档
      </span>
    </div>

    <!-- Knowledge Bases Tab -->
    <div v-if="activeTab === 'kb'">
      <div class="kb-grid" v-loading="loadingKbs">
        <el-card
          v-for="kb in kbList"
          :key="kb.id"
          shadow="never"
          class="kb-card"
          @click="$router.push(`/knowledge-bases/${kb.id}/documents`)"
        >
          <div class="kb-card-header">
            <div class="kb-card-icon" :style="{ background: getColor(kb.id).bg, color: getColor(kb.id).fg }">
              {{ (kb.name || '?').charAt(0) }}
            </div>
            <div class="kb-card-info">
              <div class="kb-card-name">{{ kb.name }}</div>
              <div class="kb-card-desc">{{ kb.description || '暂无描述' }}</div>
            </div>
          </div>
          <div class="kb-card-meta">
            <span class="meta-item"><el-icon><User /></el-icon> {{ kb.creatorName }}</span>
            <span class="meta-item"><el-icon><Document /></el-icon> {{ kb.documentCount }} 文档</span>
            <span class="meta-item"><el-icon><View /></el-icon> {{ kb.viewCount }} 浏览</span>
          </div>
          <div class="kb-card-time">
            <span>创建于 {{ formatDate(kb.createdAt) }}</span>
          </div>
        </el-card>
        <el-empty v-if="!loadingKbs && !kbList.length" description="暂无公开知识库" :image-size="80" />
      </div>
      <div class="pagination-wrap" v-if="kbTotal > 0">
        <el-pagination
          v-model:current-page="kbPage"
          :page-size="pageSize"
          :total="kbTotal"
          layout="prev, pager, next, total"
          background
          small
        />
      </div>
    </div>

    <!-- Documents Tab -->
    <div v-if="activeTab === 'doc'">
      <div class="doc-list" v-loading="loadingDocs">
        <div
          v-for="doc in docList"
          :key="doc.id"
          class="doc-card"
          @click="$router.push(`/knowledge-bases/${doc.kbId}/documents/${doc.id}`)"
        >
          <div class="doc-card-left">
            <div class="doc-type-badge" :class="doc.type === 'MARKDOWN' ? 'md' : 'file'">
              {{ doc.type === 'MARKDOWN' ? 'MD' : 'FILE' }}
            </div>
          </div>
          <div class="doc-card-center">
            <div class="doc-title">{{ doc.title }}</div>
            <div class="doc-meta">
              <span><el-icon><FolderOpened /></el-icon> {{ doc.kbName }}</span>
              <span><el-icon><User /></el-icon> {{ doc.creatorName }}</span>
              <span><el-icon><View /></el-icon> {{ doc.viewCount }} 浏览</span>
              <span><el-icon><Collection /></el-icon> {{ doc.chunkCount }} 分块</span>
            </div>
          </div>
          <div class="doc-card-right">
            <span class="doc-time">{{ formatDate(doc.createdAt) }}</span>
          </div>
        </div>
        <el-empty v-if="!loadingDocs && !docList.length" description="暂无公开文档" :image-size="80" />
      </div>
      <div class="pagination-wrap" v-if="docTotal > 0">
        <el-pagination
          v-model:current-page="docPage"
          :page-size="pageSize"
          :total="docTotal"
          layout="prev, pager, next, total"
          background
          small
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { knowledgeBaseApi } from '@/api/knowledgeBase';
import { documentApi } from '@/api/document';

const route = useRoute();
const activeTab = ref<'kb' | 'doc'>('kb');
const kbList = ref<any[]>([]);
const docList = ref<any[]>([]);
const loadingKbs = ref(false);
const loadingDocs = ref(false);
const kbPage = ref(1);
const docPage = ref(1);
const kbTotal = ref(0);
const docTotal = ref(0);
const pageSize = 10;

const colorPalette = [
  { bg: 'var(--primary-light)', fg: 'var(--primary)' },
  { bg: 'var(--success-light)', fg: 'var(--success)' },
  { bg: 'var(--warn-light)', fg: 'var(--warn)' },
  { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  { bg: 'var(--kb-purple-bg)', fg: 'var(--kb-purple)' },
];

function getColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

function formatDate(t: string) {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchKbs() {
  loadingKbs.value = true;
  try {
    const res: any = await knowledgeBaseApi.getHot({ page: kbPage.value, limit: pageSize });
    kbList.value = res.data || res || [];
    kbTotal.value = res.total || kbList.value.length;
  } finally { loadingKbs.value = false; }
}

async function fetchDocs() {
  loadingDocs.value = true;
  try {
    const res: any = await documentApi.getHot({ page: docPage.value, limit: pageSize });
    docList.value = res.data || res || [];
    docTotal.value = res.total || docList.value.length;
  } finally { loadingDocs.value = false; }
}

// Watch page changes to re-fetch
watch(() => kbPage.value, () => { fetchKbs(); });
watch(() => docPage.value, () => { fetchDocs(); });

// Reset page when switching tabs and re-fetch
watch(() => activeTab.value, () => {
  kbPage.value = 1;
  docPage.value = 1;
  fetchKbs();
  fetchDocs();
});

onMounted(() => {
  const tabParam = route.query.tab as string;
  if (tabParam === 'doc') activeTab.value = 'doc';
  fetchKbs();
  fetchDocs();
});
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

.explore-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 1px solid var(--border); padding-bottom: 0;
}
.explore-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; font-size: 14px; color: var(--fg-muted);
  cursor: pointer; transition: all 0.15s;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.explore-tab:hover { color: var(--fg); }
.explore-tab.active {
  color: var(--primary); border-bottom-color: var(--primary); font-weight: 510;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.kb-card { cursor: pointer; transition: all 0.2s; }
.kb-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
.kb-card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.kb-card-icon {
  width: 42px; height: 42px; border-radius: var(--radius);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 590;
}
.kb-card-name { font-size: 15px; font-weight: 590; letter-spacing: -0.01em; }
.kb-card-desc {
  font-size: 12.5px; color: var(--fg-muted); margin-top: 4px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.kb-card-meta {
  display: flex; gap: 16px; margin-top: 14px; padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12px; color: var(--fg-muted);
}
.meta-item { display: flex; align-items: center; gap: 4px; }
.kb-card-time {
  margin-top: 8px; font-size: 11px; color: var(--fg-muted);
}

.doc-list { display: flex; flex-direction: column; gap: 8px; }
.doc-card {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 20px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  cursor: pointer; transition: all 0.2s;
}
.doc-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
.doc-type-badge {
  width: 42px; height: 42px; border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em; flex-shrink: 0;
}
.doc-type-badge.md { background: var(--success-light); color: var(--success); }
.doc-type-badge.file { background: var(--warn-light); color: var(--warn); }
.doc-card-center { flex: 1; min-width: 0; }
.doc-title {
  font-size: 14px; font-weight: 510; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.doc-meta {
  display: flex; gap: 16px; margin-top: 6px;
  font-size: 12px; color: var(--fg-muted);
}
.doc-meta span { display: flex; align-items: center; gap: 4px; }
.doc-card-right { flex-shrink: 0; }
.doc-time { font-size: 12px; color: var(--fg-muted); }

.pagination-wrap { display: flex; justify-content: center; margin-top: 20px; }
</style>
