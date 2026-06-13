<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">检索测试</div>
        <div class="page-desc">测试知识库的检索效果，评估向量检索和相关性排序质量</div>
      </div>
    </div>

    <div class="retrieval-layout">
      <!-- Left: Query Form -->
      <div class="retrieval-sidebar">
        <el-card shadow="never">
          <el-form :model="form" label-position="top">
            <el-form-item label="选择知识库">
              <el-select v-model="form.kbId" style="width: 100%">
                <el-option
                  v-for="kb in kbList"
                  :key="kb.id"
                  :label="`${kb.name} (${kb.documentCount ?? '?'} 文档)`"
                  :value="kb.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="查询内容">
              <el-input
                v-model="form.query"
                type="textarea"
                :rows="4"
                placeholder="输入要测试的查询语句..."
              />
            </el-form-item>

            <!-- Advanced Options -->
            <el-collapse v-model="showAdvanced" style="margin-bottom: 16px">
              <el-collapse-item title="高级选项" name="adv">
                <el-form-item label="检索模式">
                  <el-select v-model="form.mode" style="width: 100%">
                    <el-option label="混合检索 (推荐)" value="hybrid" />
                    <el-option label="向量检索" value="vector" />
                    <el-option label="全文检索" value="text" />
                  </el-select>
                </el-form-item>
                <el-form-item label="Top-K">
                  <el-input-number v-model="form.topK" :min="1" :max="50" />
                </el-form-item>
                <el-form-item label="相似度阈值">
                  <el-slider v-model="form.threshold" :min="0" :max="1" :step="0.05" />
                  <span style="font-size: 12px; color: var(--fg-muted)">{{ form.threshold }}</span>
                </el-form-item>
                <el-form-item>
                  <el-switch v-model="form.queryRewrite" active-text="Query Rewrite" />
                </el-form-item>
              </el-collapse-item>
            </el-collapse>

            <el-button type="primary" style="width: 100%" :loading="searching" @click="handleSearch">
              <el-icon><Search /></el-icon> 执行检索
            </el-button>
          </el-form>
        </el-card>
      </div>

      <!-- Right: Results -->
      <div class="retrieval-results">
        <div v-if="results.length" class="results-header">
          <span class="results-title">检索结果</span>
          <div class="results-meta">
            <span>耗时: {{ elapsed }}ms</span>
            <span>结果: {{ results.length }} 条</span>
            <span>模式: {{ modeLabel }}</span>
          </div>
        </div>

        <div
          v-for="(item, index) in results"
          :key="item.id || index"
          class="retrieval-result"
        >
          <div class="retrieval-rank">
            <div class="rank-num">{{ index + 1 }}</div>
            <div class="retrieval-doc-title">{{ item.documentTitle || '未知文档' }}</div>
            <div class="retrieval-score-bar">
              <div class="retrieval-score-fill" :style="{ width: `${(item.similarity || item.score || 0) * 100}%` }"></div>
            </div>
            <div class="retrieval-score-text">{{ (item.similarity || item.score || 0).toFixed(2) }}</div>
          </div>
          <div class="retrieval-chunk" v-html="highlightQuery(item.content)"></div>
        </div>

        <el-empty v-if="searched && !results.length" description="未找到相关结果" />
        <el-empty v-if="!searched && !results.length" description="输入查询内容，点击执行检索" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { knowledgeBaseApi } from '@/api/knowledgeBase';

const kbList = ref<any[]>([]);
const form = ref({
  kbId: '',
  query: '',
  topK: 5,
  threshold: 0.3,
  mode: 'hybrid',
  queryRewrite: true,
});
const results = ref<any[]>([]);
const searching = ref(false);
const searched = ref(false);
const elapsed = ref(0);
const showAdvanced = ref<string[]>([]);

const modeLabel = computed(() => {
  const map: Record<string, string> = { hybrid: '混合检索', vector: '向量检索', text: '全文检索' };
  return map[form.value.mode] || '混合检索';
});

function highlightQuery(text: string) {
  if (!text || !form.value.query) return text;
  const words = form.value.query.split(/\s+/).filter(Boolean);
  let result = text;
  words.forEach((w) => {
    const regex = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  });
  return result;
}

async function handleSearch() {
  if (!form.value.kbId || !form.value.query) return;
  searching.value = true;
  searched.value = true;
  const start = performance.now();
  try {
    const res: any = await knowledgeBaseApi.testRetrieval(form.value.kbId, {
      query: form.value.query,
      topK: form.value.topK,
      threshold: form.value.threshold,
    });
    results.value = res.data || res || [];
  } finally {
    elapsed.value = Math.round(performance.now() - start);
    searching.value = false;
  }
}

onMounted(async () => {
  const res: any = await knowledgeBaseApi.list();
  kbList.value = res.data || res || [];
  if (kbList.value.length > 0) form.value.kbId = kbList.value[0].id;
});
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

.retrieval-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
}

.results-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.results-title { font-size: 14px; font-weight: 510; }
.results-meta { display: flex; gap: 16px; font-size: 12px; color: var(--fg-muted); }

.retrieval-result {
  padding: 14px 18px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: 10px; transition: border-color 0.15s;
}
.retrieval-result:hover { border-color: var(--primary); }

.retrieval-rank {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
}
.rank-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--primary-light); color: var(--primary);
  font-size: 12px; font-weight: 590;
  display: flex; align-items: center; justify-content: center;
}
.retrieval-doc-title { font-size: 13.5px; font-weight: 510; }
.retrieval-score-bar {
  width: 100px; height: 4px; background: var(--border);
  border-radius: 2px; margin-left: auto; overflow: hidden;
}
.retrieval-score-fill {
  height: 100%; background: var(--primary); border-radius: 2px;
}
.retrieval-score-text {
  font-size: 12px; font-weight: 510; color: var(--primary); min-width: 40px; text-align: right;
}

.retrieval-chunk {
  font-size: 13px; color: var(--fg2); line-height: 1.6;
  padding: 10px 12px; background: var(--bg); border-radius: var(--radius-sm);
  margin-top: 6px;
}
.retrieval-chunk :deep(mark) {
  background: var(--warn-light); color: var(--warn);
  padding: 0 2px; border-radius: 2px;
}

@media (max-width: 900px) {
  .retrieval-layout { grid-template-columns: 1fr; }
}
</style>
