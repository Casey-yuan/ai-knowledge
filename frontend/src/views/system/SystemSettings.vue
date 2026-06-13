<template>
  <div>
    <div class="page-header">
      <div class="page-header-left">
        <button class="back-btn" @click="$router.push('/')" title="返回工作台">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <div>
          <div class="page-title">系统设置</div>
          <div class="page-desc">管理 AI 模型、短信服务、文档分块和检索参数</div>
        </div>
      </div>
    </div>

    <div class="settings-layout">
      <!-- Embedding Config -->
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">Embedding 模型</span>
            <el-tag v-if="embeddingHealthy" type="success" size="small">已配置</el-tag>
            <el-tag v-else type="danger" size="small">未配置</el-tag>
          </div>
        </template>
        <el-form :model="settings" label-position="top">
          <el-form-item label="模型提供商">
            <el-select v-model="settings.embeddingProvider" style="width: 100%">
              <el-option label="阿里云 DashScope" value="dashscope" />
              <el-option label="智源 AI" value="zhipu" />
              <el-option label="OpenAI" value="openai" />
            </el-select>
          </el-form-item>
          <el-form-item label="模型名称">
            <el-select v-model="settings.embeddingModel" style="width: 100%" filterable allow-create>
              <el-option label="text-embedding-v3" value="text-embedding-v3" />
              <el-option label="text-embedding-v2" value="text-embedding-v2" />
            </el-select>
          </el-form-item>
          <el-form-item label="向量维度">
            <el-input-number v-model="settings.embeddingDimension" :min="256" :max="2048" :step="256" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="settings.embeddingApiKey" type="password" show-password placeholder="输入 API Key" />
          </el-form-item>
          <el-form-item label="API Base URL（可选）">
            <el-input v-model="settings.embeddingApiBase" placeholder="https://dashscope.aliyuncs.com/api/v1" />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- LLM Config -->
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">LLM 大语言模型</span>
            <el-tag v-if="llmHealthy" type="success" size="small">已配置</el-tag>
            <el-tag v-else type="danger" size="small">未配置</el-tag>
          </div>
        </template>
        <el-form :model="settings" label-position="top">
          <el-form-item label="模型提供商">
            <el-select v-model="settings.llmProvider" style="width: 100%">
              <el-option label="阿里云 DashScope（通义千问）" value="dashscope" />
              <el-option label="OpenAI（GPT）" value="openai" />
              <el-option label="Anthropic（Claude）" value="anthropic" />
            </el-select>
          </el-form-item>
          <el-form-item label="默认模型">
            <el-select v-model="settings.llmModel" style="width: 100%" filterable allow-create>
              <el-option label="qwen-plus" value="qwen-plus" />
              <el-option label="qwen-max" value="qwen-max" />
              <el-option label="qwen-turbo" value="qwen-turbo" />
            </el-select>
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="settings.llmApiKey" type="password" show-password placeholder="输入 API Key" />
          </el-form-item>
          <el-form-item label="API Base URL（可选）">
            <el-input v-model="settings.llmApiBase" placeholder="https://dashscope.aliyuncs.com/api/v1" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="settings.queryRewrite" active-text="启用查询改写" />
            <div class="form-tip">对话时自动使用 LLM 改写用户查询，提升检索召回率</div>
          </el-form-item>
          <el-form-item>
            <el-switch v-model="settings.rerankEnabled" active-text="启用 Rerank 重排序" />
            <div class="form-tip">对检索结果进行二次排序，提高回答相关度</div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- SMS Config -->
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">短信服务</span>
            <el-tag v-if="settings.smsEnabled" type="success" size="small">已启用</el-tag>
            <el-tag v-else type="info" size="small">未启用</el-tag>
          </div>
        </template>
        <el-form :model="settings" label-position="top">
          <el-form-item>
            <el-switch v-model="settings.smsEnabled" active-text="启用阿里云短信" />
            <div class="form-tip">关闭后验证码仅输出到服务器日志，适用于开发环境</div>
          </el-form-item>
          <template v-if="settings.smsEnabled">
            <el-form-item label="AccessKey ID">
              <el-input v-model="settings.smsAccessKeyId" placeholder="阿里云 AccessKey ID" />
            </el-form-item>
            <el-form-item label="AccessKey Secret">
              <el-input v-model="settings.smsAccessKeySecret" type="password" show-password placeholder="阿里云 AccessKey Secret" />
            </el-form-item>
            <el-form-item label="短信签名">
              <el-input v-model="settings.smsSignName" placeholder="已审核通过的短信签名" />
            </el-form-item>
            <el-form-item label="模板 CODE">
              <el-input v-model="settings.smsTemplateCode" placeholder="如 SMS_123456789" />
            </el-form-item>
          </template>
        </el-form>
      </el-card>

      <!-- Chunking Config -->
      <el-card shadow="never">
        <template #header><span class="card-title">文档分块</span></template>
        <el-form :model="settings" label-position="top">
          <el-form-item label="分块大小（字符）">
            <el-input-number v-model="settings.chunkSize" :min="100" :max="2000" :step="100" />
            <div class="form-tip">每个分块的最大字符数，建议 300–800</div>
          </el-form-item>
          <el-form-item label="分块重叠（字符）">
            <el-input-number v-model="settings.chunkOverlap" :min="0" :max="500" :step="10" />
            <div class="form-tip">相邻分块的重叠字符数，保持上下文连续性</div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Retrieval Defaults -->
      <el-card shadow="never">
        <template #header><span class="card-title">检索参数</span></template>
        <el-form :model="settings" label-position="top">
          <el-form-item label="默认 Top-K">
            <el-input-number v-model="settings.defaultTopK" :min="1" :max="50" />
            <div class="form-tip">每次检索返回的最大结果数</div>
          </el-form-item>
          <el-form-item label="默认相似度阈值">
            <el-slider v-model="settings.defaultThreshold" :min="0" :max="1" :step="0.05" show-input />
            <div class="form-tip">低于此阈值的结果将被过滤</div>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <div class="save-bar">
      <el-button type="primary" size="large" @click="handleSaveAll" :loading="saving">
        保存所有设置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { systemApi } from '@/api/system';

const settings = ref({
  // Embedding
  embeddingProvider: 'dashscope',
  embeddingModel: 'text-embedding-v3',
  embeddingDimension: 1024,
  embeddingApiKey: '',
  embeddingApiBase: '',
  // LLM
  llmProvider: 'dashscope',
  llmModel: 'qwen-plus',
  llmApiKey: '',
  llmApiBase: '',
  // Retrieval
  queryRewrite: true,
  rerankEnabled: false,
  defaultTopK: 5,
  defaultThreshold: 0.7,
  // Chunking
  chunkSize: 500,
  chunkOverlap: 50,
  // SMS
  smsEnabled: false,
  smsAccessKeyId: '',
  smsAccessKeySecret: '',
  smsSignName: '',
  smsTemplateCode: '',
});

const embeddingHealthy = computed(() => !!settings.value.embeddingApiKey && !settings.value.embeddingApiKey.match(/^\*+$/));
const llmHealthy = computed(() => !!settings.value.llmApiKey && !settings.value.llmApiKey.match(/^\*+$/));

const saving = ref(false);

async function handleSaveAll() {
  saving.value = true;
  try {
    await systemApi.updateSettings(settings.value);
    ElMessage.success('保存成功');
    // Reload to get masked keys
    const res: any = await systemApi.getSettings();
    const data = res.data || res;
    if (data) Object.assign(settings.value, data);
  } catch {
    /* handled by interceptor */
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    const res: any = await systemApi.getSettings();
    const data = res.data || res;
    if (data) Object.assign(settings.value, data);
  } catch {
    /* use defaults */
  }
});
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 15px; font-weight: 590; }
.form-tip { font-size: 12px; color: var(--fg-muted); margin-top: 4px; }

.back-btn {
  width: 36px; height: 36px; border-radius: var(--radius, 8px);
  border: 1px solid var(--border, #e4e7ed); background: var(--surface, #fff);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--fg-muted, #909399);
  transition: all 0.15s; flex-shrink: 0;
}
.back-btn:hover {
  background: var(--surface-hover, #f5f7fa);
  color: var(--fg, #303133);
  border-color: var(--primary, #409eff);
}

.save-bar { display: flex; justify-content: center; padding: 24px 0 8px; }
.settings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
