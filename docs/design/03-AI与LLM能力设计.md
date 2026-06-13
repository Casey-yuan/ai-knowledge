## 设计文档：AI 与 LLM 能力扩展

版本：v1.0 | 日期：2026-06-11

---

### 一、现状分析

1. **模型调用硬编码**：`LlmService` 和 `EmbeddingService` 直接使用 `process.env.ALIYUN_DASHSCOPE_API_KEY`，没有读取数据库中 `LlmProvider` 和 `EmbeddingModel` 表的配置。`KnowledgeBase` 上的 `llmProviderId` 和 `embeddingModelId` 字段形同虚设。
2. **单一模型**：所有对话固定使用 `qwen-plus`，没有按场景或知识库区分。
3. **无文档摘要**：上传文档后没有自动生成摘要的能力。
4. **无自动标签**：`Tag` 和 `DocTag` 表存在但只能手动管理。
5. **无回答质量评估**：消息的 `feedback` 字段只支持 like/dislike，没有自动评估机制。
6. **Prompt 硬编码**：系统提示词写死在 `ChatService` 中，无法按场景定制。
7. **Token 统计未实现**：`Message.tokenCount` 字段存在但未实际计算。

---

### 二、目标

1. 多模型动态切换：按知识库配置选择 LLM 和 Embedding 模型
2. 模型路由：按任务复杂度自动选择合适模型
3. 文档自动摘要
4. AI 自动打标签
5. 回答质量自动评估
6. Prompt 模板管理
7. Token 用量实际统计与展示

---

### 三、数据模型变更

#### 3.1 PromptTemplate 表（新增）

```prisma
model PromptTemplate {
  id          String   @id @default(uuid())
  name        String                    // 模板名称
  code        String   @unique          // 模板编码：chat_default, chat_concise, chat_detailed, summary, tag_extract, query_rewrite
  category    String                    // 类别：chat, summary, tag, query
  systemPrompt String                   // 系统提示词内容
  description String?                   // 说明
  variables   Json?                     // 可用变量说明
  isDefault   Boolean  @default(false)  // 是否为该类别的默认模板
  isActive    Boolean  @default(true)
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([code])
  @@index([category])
}
```

#### 3.2 KnowledgeBase 表增加字段

```prisma
model KnowledgeBase {
  // --- 新增 ---
  promptTemplateId String?              // 关联的 Prompt 模板
  answerStyle      String  @default("default") // 回答风格：default, concise, detailed, technical
}
```

#### 3.3 Message 表增加字段

```prisma
model Message {
  // --- 新增 ---
  modelUsed      String?               // 实际使用的模型名称
  promptTokens   Int?                  // prompt 消耗的 token 数
  completionTokens Int?                // completion 消耗的 token 数
  qualityScore   Float?                // AI 自动评估质量分数 (0-1)
}
```

#### 3.4 迁移 SQL

```sql
-- PromptTemplate 表
CREATE TABLE "PromptTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "description" TEXT,
  "variables" JSONB,
  "isDefault" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PromptTemplate_code_idx" ON "PromptTemplate"("code");
CREATE INDEX "PromptTemplate_category_idx" ON "PromptTemplate"("category");

-- KnowledgeBase 新增字段
ALTER TABLE "KnowledgeBase" ADD COLUMN "promptTemplateId" TEXT;
ALTER TABLE "KnowledgeBase" ADD COLUMN "answerStyle" TEXT DEFAULT 'default';

-- Message 新增字段
ALTER TABLE "Message" ADD COLUMN "modelUsed" TEXT;
ALTER TABLE "Message" ADD COLUMN "promptTokens" INTEGER;
ALTER TABLE "Message" ADD COLUMN "completionTokens" INTEGER;
ALTER TABLE "Message" ADD COLUMN "qualityScore" DOUBLE PRECISION;

-- 预置默认 Prompt 模板
INSERT INTO "PromptTemplate" ("id", "name", "code", "category", "systemPrompt", "isDefault", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '默认问答', 'chat_default', 'chat',
   '你是一个专业的知识库问答助手。请基于以下检索到的知识片段回答用户的问题。如果片段信息不足，请如实告知。回答时请标注引用来源的编号。回答时使用 Markdown 格式。',
   true, true, NOW(), NOW()),
  (gen_random_uuid(), '简洁风格', 'chat_concise', 'chat',
   '你是一个简洁的知识库问答助手。用最少的文字回答问题，直接给出关键信息，不要冗余解释。基于检索到的知识片段回答，标注引用编号。',
   false, true, NOW(), NOW()),
  (gen_random_uuid(), '详细风格', 'chat_detailed', 'chat',
   '你是一个详细的知识库问答助手。请基于检索到的知识片段给出详尽、全面的回答。包含背景说明、详细解释和示例。回答时标注引用来源编号，使用 Markdown 格式组织结构。',
   false, true, NOW(), NOW()),
  (gen_random_uuid(), '技术风格', 'chat_technical', 'chat',
   '你是一个技术导向的知识库问答助手。回答时注重技术准确性，使用专业术语，提供代码示例（如适用），标注引用来源编号。',
   false, true, NOW(), NOW()),
  (gen_random_uuid(), '文档摘要', 'summary', 'summary',
   '请为以下文档生成一份简洁的摘要（200字以内），概括文档的核心内容和关键信息。直接输出摘要内容，不要添加额外说明。',
   true, true, NOW(), NOW()),
  (gen_random_uuid(), '标签提取', 'tag_extract', 'tag',
   '请从以下文档内容中提取 3-8 个关键标签，用逗号分隔。标签应该是简短的关键词或短语，能概括文档的主题。只输出标签，不要添加其他内容。',
   true, true, NOW(), NOW()),
  (gen_random_uuid(), '查询重写', 'query_rewrite', 'query',
   '根据对话历史和当前问题，生成一个独立且完整的检索查询。只输出查询文本，不要添加其他内容。',
   true, true, NOW(), NOW());
```

---

### 四、模块设计

#### 4.1 模型提供商管理服务（ModelProviderService）

统一管理 LLM 和 Embedding 模型，替代当前硬编码的调用方式。

```
src/modules/model-provider/
├── model-provider.module.ts
├── model-provider.service.ts
```

```typescript
// model-provider.service.ts
@Injectable()
export class ModelProviderService {
  constructor(private prisma: PrismaService) {}

  /** 获取指定知识库的 LLM 配置，若无则用系统默认 */
  async getLlmForKb(kbId?: string): Promise<{
    provider: string;
    modelName: string;
    apiKey: string;
    apiBase?: string;
  }> {
    if (kbId) {
      const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
      if (kb?.llmProviderId) {
        const llm = await this.prisma.llmProvider.findUnique({ where: { id: kb.llmProviderId } });
        if (llm) return llm;
      }
    }
    // fallback: 系统默认 LLM
    const defaultLlm = await this.prisma.llmProvider.findFirst({ where: { isDefault: true } });
    if (defaultLlm) return defaultLlm;
    // fallback: 环境变量
    return {
      provider: 'dashscope',
      modelName: 'qwen-plus',
      apiKey: process.env.ALIYUN_DASHSCOPE_API_KEY || '',
      apiBase: undefined,
    };
  }

  /** 获取指定知识库的 Embedding 配置 */
  async getEmbeddingForKb(kbId?: string): Promise<{
    provider: string;
    modelName: string;
    dimension: number;
    apiKey: string;
    apiBase?: string;
  }> {
    // 类似逻辑...
  }

  /** 根据任务类型路由模型 */
  async getModelForTask(task: 'chat' | 'summary' | 'tag' | 'query_rewrite', kbId?: string) {
    const base = await this.getLlmForKb(kbId);
    // query_rewrite 和 tag 用轻量模型
    if (task === 'query_rewrite' || task === 'tag') {
      return { ...base, modelName: this.getLighterModel(base.provider) };
    }
    return base;
  }

  private getLighterModel(provider: string): string {
    const lightModels: Record<string, string> = {
      dashscope: 'qwen-turbo',
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku',
    };
    return lightModels[provider] || 'qwen-turbo';
  }
}
```

#### 4.2 LlmService 重构

```typescript
// llm.service.ts 重构为通用多提供商支持

@Injectable()
export class LlmService {
  constructor(
    private modelProvider: ModelProviderService,
    private prisma: PrismaService,
  ) {}

  async chat(messages: ChatMessage[], options?: {
    kbId?: string;
    task?: 'chat' | 'summary' | 'tag' | 'query_rewrite';
  }): Promise<ChatResponse> {
    const config = await this.modelProvider.getModelForTask(
      options?.task || 'chat', options?.kbId
    );

    // 根据 provider 分发到不同的调用实现
    const result = await this.callProvider(config, messages);
    return result;
  }

  private async callProvider(
    config: ModelConfig, messages: ChatMessage[]
  ): Promise<ChatResponse> {
    switch (config.provider) {
      case 'dashscope': return this.callDashScope(config, messages);
      case 'openai':    return this.callOpenAI(config, messages);
      case 'anthropic': return this.callAnthropic(config, messages);
      default:          return this.callDashScope(config, messages);
    }
  }

  // Token 计算（简化估算：中英文混合按 1.5 字符/token）
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 1.5);
  }
}
```

**返回结构增加 token 统计**：

```typescript
interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

#### 4.3 Prompt 模板服务

```
src/modules/prompt-template/
├── prompt-template.module.ts
├── prompt-template.service.ts
├── prompt-template.controller.ts
└── dto/
    ├── create-prompt.dto.ts
    └── update-prompt.dto.ts
```

```typescript
// prompt-template.service.ts
@Injectable()
export class PromptTemplateService {
  constructor(private prisma: PrismaService) {}

  /** 获取系统提示词，按知识库配置和模板填充 */
  async buildSystemPrompt(
    kbId?: string,
    context: string,       // 检索到的文档片段
    variables?: Record<string, string>
  ): Promise<string> {

    // 1. 确定使用哪个模板
    let templateCode = 'chat_default';
    if (kbId) {
      const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
      if (kb?.promptTemplateId) {
        const template = await this.prisma.promptTemplate.findUnique({
          where: { id: kb.promptTemplateId }
        });
        if (template) return this.renderTemplate(template.systemPrompt, context, variables);
      }
      // 按 answerStyle 选择
      if (kb?.answerStyle && kb.answerStyle !== 'default') {
        templateCode = `chat_${kb.answerStyle}`;
      }
    }

    const template = await this.prisma.promptTemplate.findFirst({
      where: { code: templateCode, isActive: true },
    });

    const prompt = template?.systemPrompt ||
      '你是一个专业的知识库问答助手。请基于检索到的知识片段回答问题，标注引用编号。';

    return this.renderTemplate(prompt, context, variables);
  }

  /** 渲染模板，替换变量 */
  private renderTemplate(
    template: string,
    context: string,
    variables?: Record<string, string>
  ): string {
    let result = template;
    result = result.replace(/\{\{context\}\}/g, context);
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }
    // 如果模板中没有 {{context}} 占位符，追加上下文
    if (!template.includes('{{context}}')) {
      result += `\n\n检索到的知识：\n${context}`;
    }
    return result;
  }

  /** 获取指定类别的摘要/标签/重写模板 */
  async getTemplateByCode(code: string): Promise<string> {
    const template = await this.prisma.promptTemplate.findFirst({
      where: { code, isActive: true },
    });
    return template?.systemPrompt || '';
  }

  // CRUD
  async findAll(category?: string) { /* ... */ }
  async create(data: any) { /* ... */ }
  async update(id: string, data: any) { /* ... */ }
  async remove(id: string) { /* ... */ }
}
```

#### 4.4 文档自动摘要

在 `IngestionProcessor` 的文档处理流水线末尾增加摘要生成步骤：

```typescript
// ingestion.processor.ts 新增步骤

// Step 4（可选）: 生成摘要和自动标签
if (doc.type === 'FILE' || (doc.content && doc.content.length > 500)) {
  try {
    await this.generateSummaryAndTags(documentId, content);
  } catch (e) {
    console.warn(`Summary/tags generation failed for ${documentId}:`, e);
    // 摘要和标签失败不影响文档处理状态
  }
}

private async generateSummaryAndTags(documentId: string, content: string) {
  const truncatedContent = content.slice(0, 4000); // 限制输入长度

  // 生成摘要
  const summaryPrompt = await this.promptTemplateService.getTemplateByCode('summary');
  const summary = await this.llmService.chat(
    [{ role: 'user', content: `${summaryPrompt}\n\n文档内容：\n${truncatedContent}` }],
    { task: 'summary' }
  );

  // 生成标签
  const tagPrompt = await this.promptTemplateService.getTemplateByCode('tag_extract');
  const tagResponse = await this.llmService.chat(
    [{ role: 'user', content: `${tagPrompt}\n\n文档内容：\n${truncatedContent}` }],
    { task: 'tag' }
  );

  // 保存摘要到 Document.metadata 或新字段
  await this.prisma.document.update({
    where: { id: documentId },
    data: { metadata: { summary: summary.content } },
  });

  // 保存标签
  const tagNames = tagResponse.content.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
  for (const tagName of tagNames) {
    const tag = await this.prisma.tag.upsert({
      where: { name: tagName },
      create: { name: tagName },
      update: {},
    });
    await this.prisma.docTag.upsert({
      where: { documentId_tagId: { documentId, tagId: tag.id } },
      create: { documentId, tagId: tag.id },
      update: {},
    });
  }
}
```

**Document 表增加摘要字段**：

```prisma
model Document {
  // --- 新增 ---
  summary  String?    // AI 生成的文档摘要
  metadata Json?      // 扩展元数据
}
```

#### 4.5 回答质量评估

采用异步后处理方式，不阻塞用户响应：

```typescript
// chat.service.ts 在保存 AI 回答后，异步入队评估任务

// 保存消息后
const assistantMsg = await this.prisma.message.create({ data: { ... } });

// 异步评估（不等待结果）
this.qualityEvalQueue.add('evaluate', {
  messageId: assistantMsg.id,
  query: content,
  answer: fullReply,
  context: retrieved.map(r => r.content).join('\n'),
}).catch(() => {}); // 评估失败不影响主流程
```

```
src/modules/quality-eval/
├── quality-eval.module.ts
├── quality-eval.processor.ts    // Bull 队列处理器
├── quality-eval.service.ts
```

```typescript
// quality-eval.service.ts
@Injectable()
export class QualityEvalService {
  /**
   * 评估回答质量，返回 0-1 之间的分数
   * 维度：faithfulness（忠实度）、relevance（相关性）
   */
  async evaluate(
    query: string, answer: string, context: string
  ): Promise<{ score: number; faithfulness: number; relevance: number }> {

    const evalPrompt = `评估以下问答的质量。给出两个维度的分数（0-1之间）：
1. 忠实度(faithfulness)：回答是否基于提供的上下文，有无编造信息
2. 相关性(relevance)：回答是否切题，是否回答了用户的问题

上下文：${context.slice(0, 2000)}
用户问题：${query}
AI回答：${answer.slice(0, 2000)}

请以JSON格式返回：{"faithfulness": 0.9, "relevance": 0.85}`;

    const result = await this.llmService.chat(
      [{ role: 'user', content: evalPrompt }],
      { task: 'query_rewrite' } // 用轻量模型
    );

    try {
      const parsed = JSON.parse(result.content);
      const score = (parsed.faithfulness * 0.6 + parsed.relevance * 0.4);
      return { score, faithfulness: parsed.faithfulness, relevance: parsed.relevance };
    } catch {
      return { score: 0, faithfulness: 0, relevance: 0 };
    }
  }
}
```

#### 4.6 Token 用量统计

```typescript
// chat.service.ts 保存消息时附带 token 信息

const assistantMsg = await this.prisma.message.create({
  data: {
    conversationId,
    role: 'assistant',
    content: fullReply,
    citations: deduplicatedCitations,
    modelUsed: llmResponse.model,
    promptTokens: llmResponse.usage?.promptTokens || this.estimateTokens(systemPrompt + context),
    completionTokens: llmResponse.usage?.completionTokens || this.estimateTokens(fullReply),
    tokenCount: (llmResponse.usage?.totalTokens) || null,
  },
});
```

---

### 五、新增 API 接口

```
GET    /prompt-templates              # 获取模板列表
POST   /prompt-templates              # 创建模板
PATCH  /prompt-templates/:id          # 更新模板
DELETE /prompt-templates/:id          # 删除模板

GET    /system/token-usage            # 获取 Token 用量统计
GET    /system/token-usage/by-kb      # 按知识库统计 Token 用量
GET    /messages/:id/quality          # 获取消息质量评估分数
```

---

### 六、前端变更

| 页面 | 变更内容 |
|---|---|
| SystemSettings.vue | 新增「Prompt 模板管理」标签页 |
| KnowledgeBaseList.vue | 创建/编辑对话框增加「回答风格」和「Prompt 模板」选择 |
| Chat.vue / FloatingChat.vue | 消息气泡增加模型标识和 token 消耗显示 |
| Dashboard.vue | 新增 Token 用量统计卡片 |

---

### 七、实现步骤

| 步骤 | 内容 | 预估改动文件 |
|---|---|---|
| 1 | Schema 变更 + migration（PromptTemplate、Document.summary、Message 扩展字段） | schema.prisma |
| 2 | 预置 Prompt 模板种子数据 | seed.ts |
| 3 | 创建 ModelProviderModule | 新增 2 文件 |
| 4 | 重构 LlmService 支持多 provider | llm.service.ts |
| 5 | 重构 EmbeddingService 支持多 provider | embedding.service.ts |
| 6 | 创建 PromptTemplateModule | 新增 4 文件 |
| 7 | IngestionProcessor 增加摘要和自动标签 | ingestion.processor.ts |
| 8 | ChatService 接入 Prompt 模板 + Token 统计 | chat.service.ts |
| 9 | 创建 QualityEvalModule | 新增 3 文件 |
| 10 | 前端设置页增加 Prompt 管理 | SystemSettings.vue |
| 11 | 前端知识库配置增加风格选择 | KnowledgeBaseList.vue |
