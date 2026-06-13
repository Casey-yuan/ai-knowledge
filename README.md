# 知源 - AI 知识库管理系统

> 一个基于 RAG（检索增强生成）技术的智能知识库管理平台，支持文档管理、智能问答、向量化检索等功能。

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Frontend)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Vue 3      │  │ Element Plus│  │  Vditor 编辑器           │  │
│  │  TypeScript │  │  UI 组件库   │  │  MarkDown 渲染           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端层 (Backend)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  NestJS 框架 + TypeScript                               │    │
│  │  ├─ RESTful API 接口层                                   │    │
│  │  ├─ JWT 认证与授权                                       │    │
│  │  ├─ 业务逻辑层 (Service)                                 │    │
│  │  └─ 数据访问层 (Prisma ORM)                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Bull 任务队列 (Redis)                                   │    │
│  │  └─ 文档解析、分块、嵌入向量化异步处理                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        基础设施层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ PostgreSQL  │  │   Redis     │  │   MinIO 对象存储         │  │
│  │  + pgvector │  │  缓存/队列   │  │   文件存储               │  │
│  │  向量数据库  │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI 服务层                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  阿里云 DashScope                                        │    │
│  │  ├─ Embedding 服务 (text-embedding-v3)                   │    │
│  │  ├─ LLM 对话 (qwen-plus/qwen-turbo)                      │    │
│  │  └─ 短信服务 (SMS)                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 核心功能模块

### 1. 用户认证与权限管理

#### 1.1 登录方式
- **账号密码登录**：支持用户名/邮箱 + 密码登录
- **手机号登录**：支持短信验证码登录
- **JWT Token 认证**：基于 Passport-JWT 的无状态认证机制

#### 1.2 用户管理
| 功能 | 说明 |
|------|------|
| 用户注册 | 支持手机号注册，自动绑定角色 |
| 用户信息 | 头像、昵称、联系方式管理 |
| 手机号绑定 | 已登录用户可绑定手机号 |
| 用户状态 | 支持启用/禁用用户账号 |

#### 1.3 角色权限系统
- 基于 RBAC（基于角色的访问控制）模型
- 支持多角色分配
- 默认角色：管理员、普通用户

**相关代码文件：**
- `backend/src/modules/auth/` - 认证模块
- `backend/src/modules/users/` - 用户管理模块
- `backend/src/modules/roles/` - 角色管理模块
- `backend/src/common/guards/jwt-auth.guard.ts` - JWT 守卫
- `backend/src/common/decorators/current-user.decorator.ts` - 当前用户装饰器

---

### 2. 知识库管理

#### 2.1 知识库 CRUD
| 功能 | 说明 |
|------|------|
| 创建知识库 | 设置名称、描述、配置参数 |
| 编辑知识库 | 修改配置信息 |
| 删除知识库 | 级联删除关联文档 |
| 查看详情 | 文档列表、配置信息 |

#### 2.2 知识库配置
```typescript
interface KnowledgeBaseConfig {
  embeddingModelId: string;      // 嵌入模型
  llmProviderId: string;         // LLM 提供商
  topK: number;                  // 检索返回数量 (默认 5)
  similarityThreshold: number;   // 相似度阈值 (默认 0.7)
  rerankEnabled: boolean;        // 是否启用重排序
  isPublic: boolean;             // 是否公开
}
```

#### 2.3 热门知识库
- 基于浏览量排序的热门知识库展示
- 支持分页查询

**相关代码文件：**
- `backend/src/modules/knowledge-bases/` - 知识库模块
- `frontend/src/views/knowledge-base/KnowledgeBaseList.vue` - 知识库列表页
- `frontend/src/views/knowledge-base/KnowledgeBaseDetail.vue` - 知识库详情页

---

### 3. 文档管理

#### 3.1 文档类型支持
| 类型 | 说明 | 处理方式 |
|------|------|----------|
| Markdown | 在线编辑的 Markdown 文档 | 直接存储 |
| FILE | 上传的文件 | 异步解析处理 |

#### 3.2 支持的文件格式
- **文本文件**: `.md`, `.txt`
- **Word 文档**: `.doc`, `.docx` (使用 mammoth 解析)
- **PDF 文档**: `.pdf` (使用 pdf-parse 解析)
- **网页**: `.html` (使用 cheerio 解析)

#### 3.3 文档生命周期
```
上传/创建 → PENDING(待处理) → PARSING(解析中) → CHUNKING(分块中) 
→ EMBEDDING(嵌入中) → COMPLETED(已完成)
                      ↓
                   FAILED(失败)
```

#### 3.4 文档版本管理
- 自动保存文档版本历史
- 支持查看历史版本差异
- 版本号自动递增

#### 3.5 文档功能
| 功能 | 说明 |
|------|------|
| 创建 Markdown | 在线创建 Markdown 文档 |
| 文件上传 | 支持最大 50MB 文件上传 |
| 内容编辑 | 使用 Vditor 富文本编辑器 |
| 发布文档 | 将文档状态改为可检索 |
| 重新索引 | 手动触发文档重新处理 |
| 搜索文档 | 全文搜索文档标题和内容 |
| 热门文档 | 基于浏览量的热门文档排行 |

**相关代码文件：**
- `backend/src/modules/documents/` - 文档模块
- `backend/src/modules/ingestion/` - 文档摄取处理模块
- `backend/src/modules/chunking/` - 文档分块模块
- `frontend/src/views/document/DocumentList.vue` - 文档列表
- `frontend/src/views/document/DocumentEditor.vue` - 文档编辑器
- `frontend/src/views/document/DocumentDetail.vue` - 文档详情

---

### 4. 文档处理流水线

#### 4.1 异步任务队列 (Bull + Redis)
```typescript
// 任务类型
interface IngestionJob {
  documentId: string;
}

// 任务配置
{
  attempts: 3,                    // 重试次数
  backoff: {
    type: 'exponential',          // 指数退避
    delay: 5000                   // 初始延迟 5s
  }
}
```

#### 4.2 处理流程
```
1. 文档上传 → 保存到 MinIO/本地
      ↓
2. 文件解析 (IngestionProcessor)
   - 根据 MIME 类型选择解析器
   - 提取纯文本内容
      ↓
3. 文本分块 (ChunkingService)
   - 按段落/句子分割
   - 保持语义完整性
   - 默认块大小: 500-1000 字符
      ↓
4. 向量化 (EmbeddingService)
   - 调用 DashScope Embedding API
   - 模型: text-embedding-v3
   - 维度: 1024
   - 存储到 pgvector
      ↓
5. 更新文档状态为 COMPLETED
```

**相关代码文件：**
- `backend/src/modules/ingestion/ingestion.processor.ts` - 摄取处理器
- `backend/src/modules/chunking/chunking.service.ts` - 分块服务
- `backend/src/modules/embedding/embedding.service.ts` - 嵌入服务

---

### 5. 智能检索系统

#### 5.1 检索模式
| 模式 | 说明 | 适用场景 |
|------|------|----------|
| 向量检索 | 基于语义相似度 | 语义理解查询 |
| 全文检索 | 基于关键词匹配 | 精确匹配查询 |
| 混合检索 | 向量 + 全文 | 综合查询 |

#### 5.2 向量检索实现
```sql
-- 使用 pgvector 的向量相似度查询
SELECT 
  c.id, c.content, c."documentId",
  1 - (c.embedding <=> $1::vector) as similarity
FROM "Chunk" c
JOIN "Document" d ON d.id = c."documentId"
WHERE d.status = 'COMPLETED'
  AND d."kbId" = $2
  AND 1 - (c.embedding <=> $1::vector) >= $3
ORDER BY similarity DESC
LIMIT $4
```

#### 5.3 全文检索实现
```sql
-- 使用 PostgreSQL 中文全文检索
SELECT 
  c.id, c.content, c."documentId",
  ts_rank(to_tsvector('chinese', c.content), 
          plainto_tsquery('chinese', $1)) as score
FROM "Chunk" c
JOIN "Document" d ON d.id = c."documentId"
WHERE d.status = 'COMPLETED'
  AND to_tsvector('chinese', c.content) @@ plainto_tsquery('chinese', $1)
ORDER BY score DESC
LIMIT $2
```

#### 5.4 检索测试工具
- 支持在知识库内测试检索效果
- 可调节 topK 和相似度阈值
- 显示检索耗时和结果数量

**相关代码文件：**
- `backend/src/modules/retrieval/` - 检索模块
- `frontend/src/views/knowledge-base/RetrievalTestPage.vue` - 检索测试页

---

### 6. AI 对话系统

#### 6.1 对话管理
| 功能 | 说明 |
|------|------|
| 创建对话 | 在指定知识库创建新对话 |
| 对话历史 | 查看历史对话列表 |
| 删除对话 | 删除对话记录 |
| 更新标题 | 修改对话标题 |

#### 6.2 消息功能
- **发送消息**: 支持普通请求和流式响应
- **引用标注**: AI 回复标注参考文档来源
- **反馈机制**: 支持点赞/点踩反馈

#### 6.3 RAG 流程
```
用户提问
    ↓
查询重写 (Query Rewriting) - 基于对话历史生成独立查询
    ↓
向量检索 - 从知识库检索相关文档块
    ↓
构建 Prompt - 组合系统提示 + 检索结果 + 用户问题
    ↓
LLM 生成回答 - 调用 DashScope API
    ↓
返回带引用的回答
```

#### 6.4 流式响应
```typescript
// SSE (Server-Sent Events) 实现
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// 逐字返回 AI 生成的内容
```

**相关代码文件：**
- `backend/src/modules/chat/` - 对话模块
- `backend/src/modules/llm/` - LLM 服务模块
- `frontend/src/components/chat/FloatingChat.vue` - 悬浮聊天组件
- `frontend/src/views/chat/Chat.vue` - 对话页面

---

### 7. 系统管理

#### 7.1 系统统计
| 指标 | 说明 |
|------|------|
| 用户总数 | 注册用户统计 |
| 知识库数 | 知识库总数 |
| 文档总数 | 文档总数 |
| 对话总数 | 对话会话数 |
| 消息总数 | 消息记录数 |

#### 7.2 审计日志
- 记录用户操作行为
- 支持按操作类型、资源类型、用户、时间筛选
- 分页查询

#### 7.3 系统设置
- Embedding 模型配置
- LLM 提供商配置
- 系统参数调整

**相关代码文件：**
- `backend/src/modules/system/` - 系统模块
- `frontend/src/views/system/SystemSettings.vue` - 系统设置页

---

### 8. 短信服务

#### 8.1 验证码发送
- 基于阿里云 SMS 服务
- 支持验证码类型：登录、注册、绑定手机
- 验证码有效期：5 分钟

**相关代码文件：**
- `backend/src/modules/sms/` - 短信模块

---

## 数据库设计

### 核心实体关系
```
User (用户)
  ├── UserRole (用户角色关联)
  ├── Document (创建的文档)
  ├── Conversation (对话记录)
  └── AuditLog (审计日志)

Role (角色)
  └── UserRole (用户角色关联)

KnowledgeBase (知识库)
  ├── Document (知识库文档)
  ├── Conversation (知识库对话)
  └── User (创建者)

Document (文档)
  ├── DocumentVersion (版本历史)
  ├── Chunk (文档分块)
  └── Tag (标签)

Conversation (对话)
  └── Message (消息记录)

EmbeddingModel (嵌入模型配置)
LlmProvider (LLM 提供商配置)
VerificationCode (验证码记录)
```

### 向量存储
- 使用 `pgvector` 扩展
- Chunk 表包含 `vector(1024)` 类型的 embedding 字段
- 支持向量相似度查询操作符 `<=>` (余弦距离)

---

## API 接口概览

### 认证相关
```
POST   /auth/login              # 账号密码登录
POST   /auth/phone-login        # 手机号登录
POST   /auth/refresh            # 刷新 Token
POST   /auth/logout             # 退出登录
GET    /auth/profile            # 获取用户信息
POST   /auth/bind-phone         # 绑定手机号
```

### 用户管理
```
GET    /users                   # 用户列表
POST   /users                   # 创建用户
GET    /users/:id               # 用户详情
PATCH  /users/:id               # 更新用户
```

### 知识库
```
GET    /knowledge-bases         # 知识库列表
GET    /knowledge-bases/hot     # 热门知识库
GET    /knowledge-bases/:id     # 知识库详情
POST   /knowledge-bases         # 创建知识库
PATCH  /knowledge-bases/:id     # 更新知识库
DELETE /knowledge-bases/:id     # 删除知识库
POST   /knowledge-bases/:id/test-retrieval  # 检索测试
```

### 文档
```
GET    /documents/hot           # 热门文档
GET    /documents/recent        # 最近文档
GET    /documents/search        # 搜索文档
GET    /knowledge-bases/:kbId/documents       # 知识库文档列表
POST   /knowledge-bases/:kbId/documents       # 上传文件
POST   /knowledge-bases/:kbId/documents/markdown  # 创建 Markdown
GET    /documents/:id           # 文档详情
GET    /documents/:id/content   # 文档内容
PUT    /documents/:id/content   # 更新文档内容
POST   /documents/:id/publish   # 发布文档
POST   /documents/:id/reindex   # 重新索引
DELETE /documents/:id           # 删除文档
```

### 对话
```
GET    /conversations           # 对话列表
POST   /conversations           # 创建对话
GET    /conversations/:id       # 对话详情
PATCH  /conversations/:id       # 更新对话
DELETE /conversations/:id       # 删除对话
GET    /conversations/:id/messages  # 消息列表
POST   /conversations/:id/messages    # 发送消息
POST   /conversations/:id/messages/stream  # 流式发送消息
POST   /messages/:id/feedback   # 消息反馈
```

### 系统
```
GET    /system/stats            # 系统统计
GET    /system/audit-logs       # 审计日志
GET    /system/settings         # 系统设置
PUT    /system/settings         # 更新设置
```

### 短信
```
POST   /sms/send                # 发送验证码
```

---

## 前端页面结构

```
/
├── /login                      # 登录页
├── /                           # 工作台 (Dashboard)
│   ├── 快捷操作区
│   ├── 热门知识库
│   ├── 热门文档
│   └── 最近文档
├── /explore                    # 探索页 (公开内容)
├── /knowledge-bases            # 知识库列表
├── /knowledge-bases/:id        # 知识库详情
├── /knowledge-bases/:id/retrieval  # 检索测试
├── /knowledge-bases/:kbId/documents  # 文档列表
├── /knowledge-bases/:kbId/documents/:id/edit  # 文档编辑
├── /knowledge-bases/:kbId/documents/:id       # 文档详情
└── /settings                   # 系统设置

全局组件:
├── FloatingChat                # 悬浮聊天组件 (全站可用)
└── SearchDialog                # 全局搜索 (Ctrl+K)
```

---

## 部署架构

### Docker Compose 服务
```yaml
services:
  postgres:     # PostgreSQL + pgvector
  redis:        # Redis 缓存和队列
  minio:        # 对象存储
  backend:      # NestJS 后端服务
  frontend:     # Vue3 前端服务 (Nginx)
```

### 环境变量
```bash
# 数据库
DATABASE_URL=postgresql://kbuser:kbpass@localhost:5432/knowledge

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=knowledge-files

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 阿里云 DashScope (AI 服务)
ALIYUN_DASHSCOPE_API_KEY=your-api-key

# 阿里云 SMS (短信服务)
ALIYUN_ACCESS_KEY_ID=your-key-id
ALIYUN_ACCESS_KEY_SECRET=your-key-secret
ALIYUN_SMS_SIGN_NAME=your-sign
ALIYUN_SMS_TEMPLATE_CODE=your-template
```

---

## 技术栈

### 后端
| 技术 | 用途 |
|------|------|
| NestJS | Node.js 框架 |
| TypeScript | 类型安全 |
| Prisma | ORM 数据库访问 |
| PostgreSQL + pgvector | 关系型数据库 + 向量扩展 |
| Redis | 缓存、任务队列 |
| Bull | 基于 Redis 的任务队列 |
| MinIO | 对象存储 |
| Passport + JWT | 认证授权 |
| Axios | HTTP 客户端 |

### 前端
| 技术 | 用途 |
|------|------|
| Vue 3 | 前端框架 |
| TypeScript | 类型安全 |
| Element Plus | UI 组件库 |
| Vue Router | 路由管理 |
| Pinia | 状态管理 |
| Vditor | Markdown 编辑器 |
| Marked | Markdown 渲染 |
| Axios | HTTP 客户端 |

### AI 服务
| 服务 | 用途 |
|------|------|
| DashScope Embedding | 文本向量化 |
| DashScope LLM | 大语言模型对话 |
| DashScope SMS | 短信服务 |

---

## 项目结构

```
knowledge/
├── backend/                    # 后端项目
│   ├── src/
│   │   ├── modules/           # 业务模块
│   │   │   ├── auth/          # 认证模块
│   │   │   ├── users/         # 用户模块
│   │   │   ├── roles/         # 角色模块
│   │   │   ├── sms/           # 短信模块
│   │   │   ├── knowledge-bases/   # 知识库模块
│   │   │   ├── documents/     # 文档模块
│   │   │   ├── ingestion/     # 文档摄取模块
│   │   │   ├── chunking/      # 分块模块
│   │   │   ├── embedding/     # 嵌入模块
│   │   │   ├── retrieval/     # 检索模块
│   │   │   ├── llm/           # LLM 模块
│   │   │   ├── chat/          # 对话模块
│   │   │   └── system/        # 系统模块
│   │   ├── common/            # 公共代码
│   │   │   ├── guards/        # 守卫
│   │   │   └── decorators/    # 装饰器
│   │   ├── prisma/            # Prisma 模块
│   │   ├── app.module.ts      # 根模块
│   │   └── main.ts            # 入口文件
│   ├── prisma/
│   │   ├── schema.prisma      # 数据库模型
│   │   └── seed.ts            # 种子数据
│   └── uploads/               # 上传文件目录
│
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── views/             # 页面视图
│   │   │   ├── login/         # 登录
│   │   │   ├── dashboard/     # 工作台
│   │   │   ├── explore/       # 探索
│   │   │   ├── knowledge-base/# 知识库
│   │   │   ├── document/      # 文档
│   │   │   ├── chat/          # 对话
│   │   │   └── system/        # 系统设置
│   │   ├── components/        # 组件
│   │   ├── layouts/           # 布局
│   │   ├── router/            # 路由
│   │   ├── api/               # API 接口
│   │   └── stores/            # Pinia 状态
│   └── public/                # 静态资源
│
├── docker-compose.yml          # Docker 编排
└── README.md                   # 项目文档
```

---

## 快速开始

### 1. 启动基础设施
```bash
docker-compose up -d postgres redis minio
```

### 2. 初始化数据库
```bash
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
```

### 3. 启动后端
```bash
npm run start:dev
```

### 4. 启动前端
```bash
cd frontend
npm install
npm run dev
```

### 5. 访问系统
- 前端: http://localhost:5173
- 后端 API: http://localhost:3000
- MinIO 控制台: http://localhost:9001

---

## 许可证

MIT License
