<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">工作台</div>
        <div class="page-desc">欢迎回来，{{ displayName }}。</div>
      </div>
    </div>

    <!-- Quick Actions (Top) -->
    <div class="quick-actions-top">
      <button class="quick-action-card" @click="showCreateKb = true">
        <div class="qa-icon" style="background: var(--primary-light); color: var(--primary)">
          <el-icon :size="22"><Plus /></el-icon>
        </div>
        <div class="qa-text">
          <div class="qa-title">新建知识库</div>
          <div class="qa-desc">创建知识库并配置</div>
        </div>
      </button>
      <button class="quick-action-card" @click="$router.push('/knowledge-bases')">
        <div class="qa-icon" style="background: var(--success-light); color: var(--success)">
          <el-icon :size="22"><Upload /></el-icon>
        </div>
        <div class="qa-text">
          <div class="qa-title">上传文档</div>
          <div class="qa-desc">支持多种文件格式</div>
        </div>
      </button>
      <button class="quick-action-card" @click="openChat">
        <div class="qa-icon" style="background: var(--warn-light); color: var(--warn)">
          <el-icon :size="22"><ChatDotSquare /></el-icon>
        </div>
        <div class="qa-text">
          <div class="qa-title">开始对话</div>
          <div class="qa-desc">智能知识问答</div>
        </div>
      </button>
    </div>

    <!-- Unified Tabbed Card -->
    <el-card shadow="never">
      <div class="dashboard-tabs">
        <span
          class="dashboard-tab"
          :class="{ active: dashboardTab === 'hotKb' }"
          @click="dashboardTab = 'hotKb'"
        >
          <el-icon><FolderOpened /></el-icon> 热门知识库
        </span>
        <span
          class="dashboard-tab"
          :class="{ active: dashboardTab === 'hotDoc' }"
          @click="dashboardTab = 'hotDoc'"
        >
          <el-icon><Document /></el-icon> 热门文档
        </span>
        <span
          class="dashboard-tab"
          :class="{ active: dashboardTab === 'recent' }"
          @click="dashboardTab = 'recent'"
        >
          <el-icon><Clock /></el-icon> 最近文档
        </span>
      </div>

      <!-- Hot Knowledge Bases Tab -->
      <div v-if="dashboardTab === 'hotKb'">
        <div class="hot-list" v-if="hotKbs.length">
          <div
            v-for="(kb, index) in hotKbs"
            :key="kb.id"
            class="hot-item"
            @click="$router.push(`/knowledge-bases/${kb.id}/documents`)"
          >
            <div class="hot-rank" :class="{ 'top-3': index < 3 }">{{ index + 1 }}</div>
            <div class="hot-content">
              <div class="hot-title">{{ kb.name }}</div>
              <div class="hot-meta">
                <span>{{ kb.creatorName }}</span>
                <span>{{ kb.documentCount }} 文档</span>
                <span>{{ kb.viewCount }} 次浏览</span>
              </div>
              <div class="hot-time">创建于 {{ formatDate(kb.createdAt) }}</div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无数据" :image-size="60" />
        <div class="view-more" v-if="hotKbs.length">
          <el-button text type="primary" size="small" @click="$router.push('/explore')">查看更多 &rarr;</el-button>
        </div>
      </div>

      <!-- Hot Documents Tab -->
      <div v-if="dashboardTab === 'hotDoc'">
        <div class="hot-list" v-if="hotDocs.length">
          <div
            v-for="(doc, index) in hotDocs"
            :key="doc.id"
            class="hot-item"
            @click="$router.push(`/knowledge-bases/${doc.kbId}/documents/${doc.id}`)"
          >
            <div class="hot-rank" :class="{ 'top-3': index < 3 }">{{ index + 1 }}</div>
            <div class="hot-content">
              <div class="hot-title">{{ doc.title }}</div>
              <div class="hot-meta">
                <span>{{ doc.kbName }}</span>
                <span>{{ doc.creatorName }}</span>
                <span>{{ doc.viewCount }} 次浏览</span>
              </div>
              <div class="hot-time">创建于 {{ formatDate(doc.createdAt) }}</div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无数据" :image-size="60" />
        <div class="view-more" v-if="hotDocs.length">
          <el-button text type="primary" size="small" @click="$router.push('/explore?tab=doc')">查看更多 &rarr;</el-button>
        </div>
      </div>

      <!-- Recent Documents Tab (unified style, no creator, no view more) -->
      <div v-if="dashboardTab === 'recent'">
        <div class="hot-list" v-if="recentDocs.length">
          <div
            v-for="(doc, index) in recentDocs"
            :key="doc.id"
            class="hot-item"
            @click="$router.push(`/knowledge-bases/${doc.kbId}/documents/${doc.id}`)"
          >
            <div class="hot-rank">{{ index + 1 }}</div>
            <div class="hot-content">
              <div class="hot-title">{{ doc.title }}</div>
              <div class="hot-meta">
                <span>{{ doc.kbName }}</span>
                <span>{{ doc.chunkCount || 0 }} 分块</span>
                <el-tag :type="statusType(doc.status)" size="small" style="transform: scale(0.85); transform-origin: left center">{{ statusLabel(doc.status) }}</el-tag>
              </div>
              <div class="hot-time">{{ formatTime(doc.updatedAt) }}</div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无最近文档" :image-size="60" />
      </div>
    </el-card>

    <!-- Create KB Dialog -->
    <el-dialog v-model="showCreateKb" title="新建知识库" width="500px">
      <el-form :model="newKb" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="newKb.name" placeholder="输入知识库名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newKb.description" type="textarea" :rows="3" placeholder="简要描述用途" />
        </el-form-item>
        <el-form-item label="可见性">
          <el-switch v-model="newKb.isPublic" active-text="公开" inactive-text="私有" />
          <span style="margin-left: 12px; font-size: 12px; color: var(--fg-muted)">
            {{ newKb.isPublic ? '所有人可见' : '仅自己可见' }}
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateKb = false">取消</el-button>
        <el-button type="primary" @click="handleCreateKb">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { knowledgeBaseApi } from '@/api/knowledgeBase';
import { documentApi } from '@/api/document';

const router = useRouter();
const auth = useAuthStore();
const chatStore = useChatStore();

const displayName = computed(() => auth.user?.nickname || auth.user?.phone || '用户');

const dashboardTab = ref<'hotKb' | 'hotDoc' | 'recent'>('hotKb');
const hotKbs = ref<any[]>([]);
const hotDocs = ref<any[]>([]);
const recentDocs = ref<any[]>([]);
const showCreateKb = ref(false);
const newKb = ref({ name: '', description: '', isPublic: true });

function formatDate(t: string) {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function statusType(status: string) {
  const map: Record<string, string> = { 'COMPLETED': 'success', 'EMBEDDING': '', 'CHUNKING': 'warning', 'FAILED': 'danger' };
  return map[status] || 'info';
}
function statusLabel(status: string) {
  const map: Record<string, string> = { 'COMPLETED': '已完成', 'EMBEDDING': '索引中', 'CHUNKING': '分块中', 'PARSING': '解析中', 'FAILED': '失败', 'PENDING': '待处理' };
  return map[status] || status;
}
function formatTime(t: string) {
  if (!t) return '';
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function openChat() { chatStore.open(); }

async function handleCreateKb() {
  if (!newKb.value.name) { ElMessage.warning('请输入名称'); return; }
  try {
    await knowledgeBaseApi.create(newKb.value);
    ElMessage.success('创建成功');
    showCreateKb.value = false;
    newKb.value = { name: '', description: '', isPublic: true };
  } catch { /* handled */ }
}

onMounted(async () => {
  try { const res: any = await knowledgeBaseApi.getHot(10); hotKbs.value = res.data || res || []; } catch {}
  try { const res: any = await documentApi.getHot(10); hotDocs.value = res.data || res || []; } catch {}
  try { const res: any = await documentApi.getRecent(10); recentDocs.value = res.data || res || []; } catch {}
});
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.page-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

/* Quick Actions Top */
.quick-actions-top {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.quick-action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.quick-action-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.qa-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.qa-title { font-size: 14px; font-weight: 590; color: var(--fg); }
.qa-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }

/* Dashboard Tabs (matches explore page tab style) */
.dashboard-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 1px solid var(--border); padding-bottom: 0;
}
.dashboard-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; font-size: 14px; color: var(--fg-muted);
  cursor: pointer; transition: all 0.15s;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.dashboard-tab:hover { color: var(--fg); }
.dashboard-tab.active {
  color: var(--primary); border-bottom-color: var(--primary); font-weight: 510;
}

.hot-list { display: flex; flex-direction: column; gap: 4px; }
.hot-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 12px; border-radius: var(--radius);
  cursor: pointer; transition: all 0.15s;
}
.hot-item:hover { background: var(--surface-hover); }
.hot-rank {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--bg2); color: var(--fg-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 590; flex-shrink: 0;
  margin-top: 2px;
}
.hot-rank.top-3 { background: var(--primary); color: var(--white); }
.hot-content { flex: 1; min-width: 0; }
.hot-title { font-size: 13px; font-weight: 510; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hot-meta { display: flex; gap: 12px; margin-top: 3px; font-size: 11px; color: var(--fg-muted); }
.hot-time { font-size: 11px; color: var(--fg-muted); margin-top: 2px; opacity: 0.7; }

.view-more { display: flex; justify-content: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle); }

@media (max-width: 1200px) {
  .quick-actions-top { grid-template-columns: repeat(2, 1fr); }
}
</style>
