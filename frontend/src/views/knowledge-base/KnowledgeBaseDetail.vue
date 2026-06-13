<template>
  <div>
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push('/knowledge-bases')" title="返回知识库">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title">{{ kb?.name || '加载中...' }}</div>
          <div class="page-desc">{{ kb?.description }}</div>
        </div>
      </div>
      <div class="page-actions">
        <el-button @click="$router.push(`/knowledge-bases/${route.params.id}/documents`)">
          <el-icon><Document /></el-icon> 文档管理
        </el-button>
        <el-button @click="$router.push(`/knowledge-bases/${route.params.id}/retrieval`)">
          <el-icon><Search /></el-icon> 检索测试
        </el-button>
        <el-button @click="showSettings = true">
          <el-icon><Setting /></el-icon> 设置
        </el-button>
      </div>
    </div>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="Top-K">{{ kb?.topK }}</el-descriptions-item>
      <el-descriptions-item label="相似度阈值">{{ kb?.similarityThreshold }}</el-descriptions-item>
      <el-descriptions-item label="文档数">{{ kb?.documentCount ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="分块数">{{ kb?.chunkCount ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="浏览次数">{{ kb?.viewCount ?? 0 }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ formatDate(kb?.createdAt) }}</el-descriptions-item>
    </el-descriptions>

    <el-dialog v-model="showSettings" title="知识库设置" width="500px">
      <el-form v-if="kb" :model="editForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Top-K">
          <el-input-number v-model="editForm.topK" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="相似度阈值">
          <el-slider v-model="editForm.similarityThreshold" :min="0" :max="1" :step="0.05" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="handleSaveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { knowledgeBaseApi } from '@/api/knowledgeBase';

const route = useRoute();
const kb = ref<any>(null);
const showSettings = ref(false);
const editForm = ref({ name: '', description: '', topK: 5, similarityThreshold: 0.7 });

function formatDate(t: string) {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

onMounted(async () => {
  const res: any = await knowledgeBaseApi.get(route.params.id as string);
  kb.value = res.data || res;
  editForm.value = {
    name: kb.value.name,
    description: kb.value.description || '',
    topK: kb.value.topK || 5,
    similarityThreshold: kb.value.similarityThreshold || 0.7,
  };
});

async function handleSaveSettings() {
  try {
    await knowledgeBaseApi.update(route.params.id as string, editForm.value);
    ElMessage.success('保存成功');
    showSettings.value = false;
    const res: any = await knowledgeBaseApi.get(route.params.id as string);
    kb.value = res.data || res;
  } catch { /* handled */ }
}
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
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }
.page-actions { display: flex; gap: 8px; flex-shrink: 0; }
</style>
