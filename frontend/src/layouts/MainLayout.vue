<template>
  <div class="app-shell">
    <!-- Top Navigation -->
    <nav class="topnav">
      <div class="topnav-brand" @click="$router.push('/')">
        <div class="topnav-brand-icon">知</div>
        <span class="topnav-brand-text">知源</span>
      </div>
      
      <div class="topnav-right">
        <!-- Search -->
        <div class="topnav-search" @click="showSearchDialog = true">
          <el-icon :size="14"><Search /></el-icon>
          <span>搜索文档...</span>
          <kbd>Ctrl K</kbd>
        </div>

        <!-- Theme Toggle -->
        <div
          class="theme-switch"
          :class="{ dark: theme.theme === 'dark' }"
          @click="theme.toggle()"
        ></div>

        <!-- User Chip -->
        <el-dropdown trigger="click" @command="handleUserCommand">
          <div class="user-chip">
            <div class="user-chip-avatar">{{ userInitial }}</div>
            <span class="user-chip-name">{{ displayName }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon> 系统设置
            </el-dropdown-item>
            <el-dropdown-item command="knowledgeBases">
              <el-icon><FolderOpened /></el-icon> 知识库管理
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon><SwitchButton /></el-icon> 退出登录
            </el-dropdown-item>
          </template>
        </el-dropdown>
      </div>
    </nav>

    <!-- Content -->
    <main class="content-area">
      <router-view />
    </main>

    <!-- Floating Chat (always visible) -->
    <FloatingChat />

    <!-- Search Dialog -->
    <el-dialog v-model="showSearchDialog" title="搜索文档" width="560px" top="10vh">
      <el-input
        v-model="searchQuery"
        placeholder="输入关键词搜索文档..."
        :prefix-icon="Search"
        clearable
        @input="handleSearch"
        autofocus
      />
      <div class="search-results" v-if="searchResults.length">
        <div
          v-for="doc in searchResults"
          :key="doc.id"
          class="search-result-item"
          @click="goToDocument(doc)"
        >
          <div class="search-result-title">{{ doc.title }}</div>
          <div class="search-result-meta">
            <span>{{ doc.kbName }}</span>
            <span>{{ formatTime(doc.updatedAt) }}</span>
          </div>
          <div class="search-result-content" v-html="highlightContent(doc.content)"></div>
        </div>
      </div>
      <el-empty v-else-if="searchQuery && !searching" description="未找到相关文档" :image-size="60" />
      <div v-if="searching" class="search-loading">
        <el-icon class="is-loading"><Loading /></el-icon> 搜索中...
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Search, FolderOpened, SwitchButton, Loading, Setting } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { documentApi } from '@/api/document';
import FloatingChat from '@/components/chat/FloatingChat.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const theme = useThemeStore();

const showSearchDialog = ref(false);
const searchQuery = ref('');
const searchResults = ref<any[]>([]);
const searching = ref(false);

const displayName = computed(() => {
  return auth.user?.nickname || auth.user?.phone || '用户';
});

const userInitial = computed(() => {
  const name = displayName.value;
  return name.charAt(0);
});

let searchTimer: any = null;

function handleSearch() {
  clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const res: any = await documentApi.search(searchQuery.value, 10);
      searchResults.value = res.data || res || [];
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
}

function goToDocument(doc: any) {
  showSearchDialog.value = false;
  searchQuery.value = '';
  searchResults.value = [];
  router.push(`/knowledge-bases/${doc.kb?.id || doc.kbId}/documents/${doc.id}`);
}

function highlightContent(content: string) {
  if (!content || !searchQuery.value) return content;
  const query = searchQuery.value.trim();
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return content.replace(regex, '<mark>$1</mark>');
}

function formatTime(t: string) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function handleUserCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  } else if (cmd === 'knowledgeBases') {
    router.push('/knowledge-bases');
  } else if (cmd === 'settings') {
    router.push('/settings');
  }
}

// Keyboard shortcut for search
onMounted(async () => {
  theme.init();
  
  // Restore user profile if token exists but user is not loaded
  if (auth.token && !auth.user) {
    await auth.fetchUserProfile();
  }
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      showSearchDialog.value = true;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Top Navigation */
.topnav {
  height: 56px;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--nav-border);
  display: flex;
  align-items: center;
  padding: 0 24px;
  position: relative;
  z-index: 100;
  transition: background 0.25s;
  flex-shrink: 0;
}

.topnav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.topnav-brand-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--brand-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}
.topnav-brand-text {
  font-size: 15px;
  font-weight: 590;
  letter-spacing: -0.01em;
  color: var(--fg);
  white-space: nowrap;
}

.topnav-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.topnav-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg-muted);
  font-size: 13px;
  cursor: pointer;
  min-width: 200px;
  transition: border-color 0.15s;
}
.topnav-search:hover {
  border-color: var(--primary);
}
.topnav-search kbd {
  font-size: 11px;
  background: var(--bg2);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--border);
  margin-left: auto;
  font-family: inherit;
}

/* Theme switch */
.theme-switch {
  width: 40px;
  height: 22px;
  background: var(--border);
  border-radius: 11px;
  position: relative;
  cursor: pointer;
  transition: background 0.25s;
  flex-shrink: 0;
}
.theme-switch::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--white);
  top: 3px;
  left: 3px;
  transition: transform 0.25s;
  box-shadow: var(--shadow-sm);
}
.theme-switch.dark {
  background: var(--primary);
}
.theme-switch.dark::after {
  transform: translateX(18px);
}

/* Icon button */
.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-muted);
  transition: all 0.15s;
  position: relative;
}
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--fg);
  border-color: var(--primary);
}

/* User chip */
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--border);
}
.user-chip:hover {
  background: var(--surface-hover);
  border-color: var(--primary);
}
.user-chip-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--seed-avatar-a, linear-gradient(135deg, #4facfe, #00f2fe));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  font-size: 12px;
  font-weight: 590;
  flex-shrink: 0;
}
.user-chip-name {
  font-size: 13px;
  font-weight: 510;
  color: var(--fg);
}

/* Content */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg);
}

/* Search Dialog */
.search-results {
  margin-top: 16px;
  max-height: 400px;
  overflow-y: auto;
}
.search-result-item {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.search-result-item:hover {
  border-color: var(--primary);
  background: var(--surface-hover);
}
.search-result-title {
  font-size: 14px;
  font-weight: 510;
  color: var(--fg);
  margin-bottom: 4px;
}
.search-result-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--fg-muted);
  margin-bottom: 6px;
}
.search-result-content {
  font-size: 12px;
  color: var(--fg2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.search-result-content :deep(mark) {
  background: var(--warn-light);
  color: var(--warn);
  padding: 0 2px;
  border-radius: 2px;
}
.search-loading {
  text-align: center;
  padding: 20px;
  color: var(--fg-muted);
  font-size: 13px;
}
</style>
