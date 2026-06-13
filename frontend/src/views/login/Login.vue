<template>
  <div class="login-page">
    <div class="login-bg-pattern"></div>
    <!-- 右上角主题切换 -->
    <div class="login-theme-toggle" @click="theme.toggle()" :title="theme.theme === 'dark' ? '切换亮色' : '切换暗色'">
      <el-icon :size="16"><component :is="theme.theme === 'dark' ? 'Moon' : 'Sunny'" /></el-icon>
    </div>
    <div class="login-card">
      <div class="login-brand">
        <div class="login-brand-icon">知</div>
        <div class="login-brand-name">知源</div>
        <div class="login-brand-desc">让知识触手可及</div>
      </div>

      <!-- 密码登录表单 -->
      <el-form
        v-if="mode === 'login'"
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="0"
        class="login-form"
      >
        <el-form-item prop="username">
          <el-input
            v-model="passwordForm.username"
            placeholder="用户名 / 手机号"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="passwordForm.password"
            type="password"
            placeholder="密码"
            size="large"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handlePasswordLogin"
          >登 录</el-button>
        </el-form-item>
      </el-form>

      <!-- 注册表单 -->
      <el-form
        v-else-if="mode === 'register'"
        ref="registerFormRef"
        :model="registerForm"
        :rules="registerRules"
        label-width="0"
        class="login-form"
      >
        <el-form-item prop="username">
          <el-input
            v-model="registerForm.username"
            placeholder="用户名"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="密码"
            size="large"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="确认密码"
            size="large"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item prop="nickname">
          <el-input
            v-model="registerForm.nickname"
            placeholder="昵称（选填）"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="phone">
          <el-input
            v-model="registerForm.phone"
            placeholder="手机号（选填）"
            size="large"
            prefix-icon="Phone"
            maxlength="11"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleRegister"
          >注 册</el-button>
        </el-form-item>
      </el-form>

      <!-- 短信登录表单 -->
      <el-form
        v-else-if="mode === 'sms'"
        ref="smsFormRef"
        :model="smsForm"
        :rules="smsRules"
        label-width="0"
        class="login-form"
      >
        <el-form-item prop="phone">
          <el-input
            v-model="smsForm.phone"
            placeholder="手机号"
            size="large"
            prefix-icon="Phone"
            maxlength="11"
          />
        </el-form-item>
        <el-form-item prop="code">
          <div style="display: flex; gap: 10px; width: 100%">
            <el-input
              v-model="smsForm.code"
              placeholder="验证码"
              size="large"
              prefix-icon="Key"
              maxlength="6"
              style="flex: 1"
            />
            <el-button :disabled="countdown > 0" size="large" @click="handleSendSms" class="sms-send-btn">
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleSmsLogin"
          >登 录</el-button>
        </el-form-item>
      </el-form>

      <!-- 底部切换链接区域 -->
      <div class="login-mode-links">
        <!-- 登录模式 -->
        <template v-if="mode === 'login'">
          <span class="login-mode-link" @click="mode = 'register'">
            <el-icon :size="14"><Plus /></el-icon>
            <span>注册账号</span>
          </span>
          <span class="login-mode-link" @click="mode = 'sms'">
            <el-icon :size="14"><Phone /></el-icon>
            <span>短信登录</span>
          </span>
        </template>
        <!-- 注册模式 -->
        <template v-else-if="mode === 'register'">
          <span class="login-mode-link" @click="mode = 'login'">
            <el-icon :size="14"><User /></el-icon>
            <span>已有账号？返回登录</span>
          </span>
        </template>
        <!-- 短信登录模式 -->
        <template v-else-if="mode === 'sms'">
          <span class="login-mode-link" @click="mode = 'login'">
            <el-icon :size="14"><Lock /></el-icon>
            <span>返回密码登录</span>
          </span>
        </template>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Phone, Key, Plus } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { authApi } from '@/api/auth';

const router = useRouter();
const auth = useAuthStore();
const theme = useThemeStore();

const mode = ref<'login' | 'register' | 'sms'>('login');
const loading = ref(false);
const countdown = ref(0);

// 密码登录
const passwordForm = ref({ username: '', password: '' });
const passwordRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

// 注册
const registerForm = ref({ username: '', password: '', confirmPassword: '', nickname: '', phone: '' });
const registerRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== registerForm.value.password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
};

// 短信登录
const smsForm = ref({ phone: '', code: '' });
const smsRules = {
  phone: [{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }],
  code: [{ required: true, len: 6, message: '请输入6位验证码', trigger: 'blur' }],
};

async function handlePasswordLogin() {
  loading.value = true;
  try {
    await auth.login(passwordForm.value);
    ElMessage.success('登录成功');
    router.push('/');
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  loading.value = true;
  try {
    await authApi.register({
      username: registerForm.value.username,
      password: registerForm.value.password,
      nickname: registerForm.value.nickname || undefined,
      phone: registerForm.value.phone || undefined,
    });
    ElMessage.success('注册成功，请登录');
    mode.value = 'login';
    passwordForm.value.username = registerForm.value.username;
    passwordForm.value.password = '';
  } finally {
    loading.value = false;
  }
}

async function handleSendSms() {
  try {
    await authApi.sendSms({ phone: smsForm.value.phone });
    ElMessage.success('验证码已发送');
    countdown.value = 60;
    const timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch { /* handled */ }
}

async function handleSmsLogin() {
  loading.value = true;
  try {
    await auth.phoneLogin(smsForm.value);
    ElMessage.success('登录成功');
    router.push('/');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  theme.init();
});
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  position: relative;
}
.login-bg-pattern {
  position: absolute; inset: 0; opacity: 0.03;
  background-image: radial-gradient(circle at 1px 1px, var(--fg) 1px, transparent 0);
  background-size: 40px 40px;
}
.login-card {
  width: 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 40px;
  box-shadow: var(--shadow-lg);
  position: relative;
}
.login-brand { text-align: center; margin-bottom: 32px; }
.login-brand-icon {
  width: 48px; height: 48px; border-radius: 12px; margin: 0 auto 16px;
  background: var(--brand-gradient);
  display: flex; align-items: center; justify-content: center;
  color: var(--white); font-size: 22px; font-weight: 600;
}
.login-brand-name { font-size: 20px; font-weight: 590; letter-spacing: -0.02em; }
.login-brand-desc { font-size: 13px; color: var(--fg-muted); margin-top: 4px; }

.login-form { margin-top: 20px; }
.login-btn { width: 100%; }

.sms-send-btn {
  padding: 8px 14px; white-space: nowrap;
  border: 1px solid var(--primary) !important;
  color: var(--primary) !important;
  background: transparent !important;
}

/* 底部模式切换链接 */
.login-mode-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.login-mode-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.2s;
  user-select: none;
}
.login-mode-link:hover {
  color: var(--primary);
}

/* Top-right theme toggle */
.login-theme-toggle {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-muted);
  transition: all 0.2s;
  z-index: 10;
}
.login-theme-toggle:hover {
  background: var(--surface-hover);
  color: var(--primary);
  border-color: var(--primary);
}
</style>
