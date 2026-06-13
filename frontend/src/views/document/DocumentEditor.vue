<template>
  <div style="height: calc(100vh - 180px); display: flex; flex-direction: column">
    <div class="editor-header">
      <div class="editor-header-left">
        <button class="back-btn" @click="$router.back()" title="返回">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </button>
        <span class="editor-title">{{ title || '新建文档' }}</span>
      </div>
      <div class="editor-header-right">
        <el-button @click="handleSave" type="primary" :loading="saving">保存</el-button>
        <el-button @click="handlePublish" type="success" :loading="publishing">发布</el-button>
      </div>
    </div>
    <el-input v-model="title" placeholder="文档标题" style="margin-bottom: 12px" />
    <div ref="editorRef" style="flex: 1"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { documentApi } from '@/api/document';

const route = useRoute();
const docId = route.params.id as string;
const editing = !!docId;

const editorRef = ref<HTMLDivElement>();
const saving = ref(false);
const publishing = ref(false);
const title = ref('');
const content = ref('');

let vditor: any = null;

async function initEditor() {
  const Vditor = (await import('vditor')).default;
  await import('vditor/dist/index.css');

  if (editing) {
    const res: any = await documentApi.getContent(docId);
    const data = res.data || res;
    title.value = data.title || '';
    content.value = data.content || '';
  }

  vditor = new Vditor(editorRef.value!, {
    height: '100%',
    mode: 'wysiwyg',
    placeholder: '开始编写文档...',
    cache: { enable: false },
    toolbarConfig: { pin: true },
    value: content.value,
    after: () => {
      if (content.value) {
        vditor.setValue(content.value);
      }
    },
    upload: {
      url: '/api/documents/upload-image',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      filename: (name: string) => name,
    },
  });
}

async function handleSave() {
  saving.value = true;
  try {
    const contentText = vditor?.getValue() || '';
    await documentApi.updateContent(docId, { title: title.value, content: contentText });
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
}

async function handlePublish() {
  await handleSave();
  publishing.value = true;
  try {
    await documentApi.publish(docId);
    ElMessage.success('发布成功，已加入检索');
  } finally {
    publishing.value = false;
  }
}

onMounted(initEditor);

onBeforeUnmount(() => {
  vditor?.destroy();
});
</script>

<style scoped>
.editor-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.editor-header-left { display: flex; align-items: center; gap: 12px; }
.editor-header-right { display: flex; gap: 8px; }
.back-btn {
  width: 36px; height: 36px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--surface);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s; color: var(--fg-muted); flex-shrink: 0;
}
.back-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
.editor-title { font-size: 16px; font-weight: 590; }
</style>
