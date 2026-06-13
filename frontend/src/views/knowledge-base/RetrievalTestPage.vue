<template>
  <div>
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push('/knowledge-bases')" title="返回知识库">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title">检索测试</div>
          <div class="page-desc">{{ kbName }}</div>
        </div>
      </div>
    </div>

    <!-- Two-Column Layout -->
    <div class="retrieval-grid">
      <!-- Left: Query Configuration -->
      <div class="config-column">
        <el-card shadow="never" class="query-panel">
          <template #header>
            <span class="panel-title">查询配置</span>
          </template>

          <!-- Query Input -->
          <el-input
            v-model="query"
            type="textarea"
            :rows="4"
            placeholder="输入要测试的查询语句... (Ctrl+Enter 执行)"
            autofocus
            @keydown.ctrl.enter="execute"
          />

          <!-- Search Mode -->
          <div class="config-section">
            <label class="config-label">检索模式</label>
            <el-radio-group v-model="mode" size="small">
              <el-radio-button value="vector">向量检索</el-radio-button>
              <el-radio-button value="fulltext">全文检索</el-radio-button>
              <el-radio-button value="hybrid">混合检索</el-radio-button>
            </el-radio-group>
          </div>

          <!-- Top-K & Threshold -->
          <div class="config-row">
            <div class="config-item">
              <label>Top-K</label>
              <el-input-number v-model="topK" :min="1" :max="20" size="small" />
            </div>
            <div class="config-item">
              <label>相似度阈值</label>
              <el-slider v-model="threshold" :min="0" :max="1" :step="0.05" style="width: 140px" />
              <span class="config-value">{{ threshold }}</span>
            </div>
          </div>

          <!-- Execute Button -->
          <div class="execute-row">
            <el-button
              type="primary"
              @click="execute"
              :loading="searching"
              :disabled="!query.trim()"
              class="execute-btn"
            >
              <el-icon><Search /></el-icon> 执行检索
            </el-button>
            <span class="shortcut-hint">Ctrl+Enter</span>
          </div>

          <!-- Query History -->
          <div v-if="queryHistory.length" class="history-section">
            <div class="history-header">
              <label class="config-label">最近查询</label>
              <el-button text size="small" type="info" @click="queryHistory = []">清除</el-button>
            </div>
            <div class="history-chips">
              <el-tag
                v-for="(hq, idx) in queryHistory"
                :key="idx"
                class="history-chip"
                size="small"
                effect="plain"
                round
                @click="restoreQuery(hq)"
              >
                {{ hq }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Right: Results -->
      <div class="results-column">
        <el-card shadow="never" class="results-panel">
          <template #header>
            <div class="results-header">
              <span class="panel-title">检索结果</span>
              <div v-if="searched" class="results-actions">
                <el-tag type="info" size="small">找到 {{ results.length }} 条</el-tag>
                <el-tag type="success" size="small">耗时 {{ elapsed }}ms</el-tag>
                <el-button
                  size="small"
                  text
                  type="primary"
                  @click="copyResults"
                  :disabled="!results.length"
                  title="复制结果为 JSON"
                >
                  <el-icon><CopyDocument /></el-icon> 导出
                </el-button>
              </div>
            </div>
          </template>

          <!-- Statistics Summary Bar -->
          <div v-if="searched && results.length" class="stats-bar">
            <div class="stat-item">
              <span class="stat-label">结果数</span>
              <span class="stat-value">{{ results.length }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">平均相似度</span>
              <span class="stat-value" :style="{ color: getScoreColor(avgSimilarity) }">
                {{ (avgSimilarity * 100).toFixed(1) }}%
              </span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">最高分</span>
              <span class="stat-value stat-high" :style="{ color: getScoreColor(maxSimilarity) }">
                {{ (maxSimilarity * 100).toFixed(1) }}%
              </span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">最低分</span>
              <span class="stat-value stat-low" :style="{ color: getScoreColor(minSimilarity) }">
                {{ (minSimilarity * 100).toFixed(1) }}%
              </span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">耗时</span>
              <span class="stat-value">{{ elapsed }}ms</span>
            </div>
          </div>

          <!-- Result List -->
          <div v-if="results.length" class="result-list">
            <div
              v-for="(item, index) in results"
              :key="item.id || index"
              class="result-card"
            >
              <div class="result-top">
                <span class="result-rank" :class="{ 'top-3': index < 3 }">
                  {{ index + 1 }}
                </span>
                <span
                  class="result-doc-title"
                  :title="'查看文档详情'"
                  @click="goToDocument(item)"
                >
                  {{ item.documentTitle || '未命名文档' }}
                </span>
                <span class="result-score" :style="{ color: getScoreColor(item.similarity) }">
                  {{ (item.similarity * 100).toFixed(1) }}%
                </span>
              </div>

              <!-- Score Bar -->
              <div class="result-bar-wrap">
                <div
                  class="result-bar"
                  :style="{
                    width: (item.similarity * 100) + '%',
                    background: getScoreGradient(item.similarity)
                  }"
                ></div>
              </div>

              <!-- Content -->
              <div class="result-content">{{ item.content }}</div>

              <!-- Metadata Footer -->
              <div class="result-meta">
                <span v-if="item.chunkIndex !== undefined">
                  <el-icon :size="12"><Document /></el-icon>
                  分块 #{{ item.chunkIndex }}
                </span>
                <span v-if="item.documentId">
                  <el-icon :size="12"><Key /></el-icon>
                  {{ item.documentId }}
                </span>
                <span v-if="item.id && item.id !== item.documentId">
                  ID: {{ item.id }}
                </span>
              </div>
            </div>
          </div>

          <!-- Empty States -->
          <el-empty
            v-if="searched && !results.length"
            description="未找到相关结果，请尝试降低阈值或更换查询词"
            :image-size="100"
          />
          <div v-if="!searched" class="empty-hint">
            <el-icon :size="48" color="var(--fg-muted)"><Search /></el-icon>
            <p>输入查询内容后点击"执行检索"</p>
            <p class="empty-sub">支持 Ctrl+Enter 快捷执行</p>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { knowledgeBaseApi } from '@/api/knowledgeBase';

const route = useRoute();
const router = useRouter();
const kbId = route.params.id as string;
const kbName = ref('');

// Query state
const query = ref('');
const topK = ref(5);
const threshold = ref(0.3);
const mode = ref<'vector' | 'fulltext' | 'hybrid'>('vector');

// Results state
const results = ref<any[]>([]);
const searching = ref(false);
const searched = ref(false);
const elapsed = ref(0);

// Query history (component state only, max 10)
const queryHistory = ref<string[]>([]);

// Computed statistics
const avgSimilarity = computed(() => {
  if (!results.value.length) return 0;
  const sum = results.value.reduce((acc, r) => acc + (r.similarity || 0), 0);
  return sum / results.value.length;
});

const maxSimilarity = computed(() => {
  if (!results.value.length) return 0;
  return Math.max(...results.value.map(r => r.similarity || 0));
});

const minSimilarity = computed(() => {
  if (!results.value.length) return 0;
  return Math.min(...results.value.map(r => r.similarity || 0));
});

// Score color coding
function getScoreColor(score: number): string {
  if (score >= 0.8) return 'var(--success)';
  if (score >= 0.6) return 'var(--warn)';
  return 'var(--danger)';
}

function getScoreGradient(score: number): string {
  if (score >= 0.8) return 'var(--success)';
  if (score >= 0.6) return 'var(--warn)';
  return 'var(--danger)';
}

// Add query to history (deduplicated, max 10)
function addToHistory(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  queryHistory.value = [
    trimmed,
    ...queryHistory.value.filter(h => h !== trimmed),
  ].slice(0, 10);
}

function restoreQuery(hq: string) {
  query.value = hq;
}

// Navigate to document detail
function goToDocument(item: any) {
  const docId = item.documentId || item.id;
  if (docId) {
    router.push(`/knowledge-bases/${kbId}/documents/${docId}`);
  }
}

// Copy results as JSON
async function copyResults() {
  if (!results.value.length) return;
  try {
    const json = JSON.stringify(results.value, null, 2);
    await navigator.clipboard.writeText(json);
    ElMessage.success('结果已复制到剪贴板');
  } catch {
    ElMessage.error('复制失败，请手动选择');
  }
}

// Execute search
async function execute() {
  if (!query.value.trim()) {
    ElMessage.warning('请输入查询内容');
    return;
  }

  addToHistory(query.value);
  searching.value = true;
  searched.value = true;

  const start = performance.now();
  try {
    const res: any = await knowledgeBaseApi.testRetrieval(kbId, {
      query: query.value,
      topK: topK.value,
      threshold: threshold.value,
      mode: mode.value,
    });
    results.value = res.data || [];
    elapsed.value = Math.round(performance.now() - start);
  } catch {
    results.value = [];
    elapsed.value = Math.round(performance.now() - start);
  } finally {
    searching.value = false;
  }
}

// Global keyboard shortcut (Ctrl+Enter from anywhere on page)
function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    execute();
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown);
  try {
    const res: any = await knowledgeBaseApi.get(kbId);
    kbName.value = res.data?.name || res.name || '';
  } catch {}
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* ═══ Page Header ═══ */
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
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--fg-muted);
  flex-shrink: 0;
}
.back-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.page-title {
  font-size: 20px;
  font-weight: 590;
  letter-spacing: -0.02em;
}
.page-desc {
  font-size: 13px;
  color: var(--fg-muted);
  margin-top: 4px;
}

/* ═══ Two-Column Grid Layout ═══ */
.retrieval-grid {
  display: grid;
  grid-template-columns: minmax(280px, 30%) 1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 900px) {
  .retrieval-grid {
    grid-template-columns: 1fr;
  }
}

/* ═══ Config Column ═══ */
.config-column {
  position: sticky;
  top: 16px;
}

.panel-title {
  font-size: 15px;
  font-weight: 590;
}

/* ═══ Query Panel Internals ═══ */
.config-section {
  margin-top: 16px;
}

.config-label {
  display: block;
  font-size: 13px;
  color: var(--fg-muted);
  margin-bottom: 8px;
  font-weight: 500;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--fg-muted);
}

.config-item label {
  white-space: nowrap;
}

.config-value {
  font-size: 12px;
  min-width: 28px;
  text-align: center;
  color: var(--fg);
  font-weight: 510;
}

.execute-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.execute-btn {
  width: 100%;
}

.shortcut-hint {
  font-size: 11px;
  color: var(--fg-subtle);
  white-space: nowrap;
  padding: 2px 6px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--bg2);
}

/* ═══ Query History ═══ */
.history-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.history-chip {
  cursor: pointer;
  transition: all 0.15s;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-chip:hover {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-light);
}

/* ═══ Results Panel ═══ */
.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.results-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ═══ Statistics Summary Bar ═══ */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 12px 16px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 11px;
  color: var(--fg-muted);
  white-space: nowrap;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.stat-high {
  font-weight: 700;
}

.stat-low {
  font-weight: 700;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: var(--border);
  flex-shrink: 0;
  margin: 0 4px;
}

/* ═══ Result Cards ═══ */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 0.15s;
}

.result-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.result-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.result-rank {
  font-size: 11px;
  font-weight: 700;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bg2);
  color: var(--fg-muted);
  flex-shrink: 0;
}

.result-rank.top-3 {
  background: var(--primary);
  color: var(--white);
}

.result-doc-title {
  font-size: 14px;
  font-weight: 510;
  flex: 1;
  cursor: pointer;
  transition: color 0.15s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-doc-title:hover {
  color: var(--primary);
  text-decoration: underline;
}

.result-score {
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.result-bar-wrap {
  height: 4px;
  background: var(--bg2);
  border-radius: 2px;
  margin-bottom: 12px;
  overflow: hidden;
}

.result-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.result-content {
  font-size: 13px;
  color: var(--fg2);
  line-height: 1.7;
  background: var(--bg);
  padding: 12px;
  border-radius: var(--radius);
  white-space: pre-wrap;
  word-break: break-word;
}

.result-meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--fg-muted);
}

.result-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ═══ Empty States ═══ */
.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 12px;
  color: var(--fg-muted);
  font-size: 14px;
}

.empty-sub {
  font-size: 12px;
  color: var(--fg-subtle);
  margin-top: -4px;
}

/* ═══ Responsive fine-tuning ═══ */
@media (max-width: 900px) {
  .config-column {
    position: static;
  }

  .stats-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .stat-divider {
    display: none;
  }

  .stat-item {
    min-width: 80px;
  }
}
</style>
