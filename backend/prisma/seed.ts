import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    create: { name: 'admin', label: '管理员' },
    update: {},
  });
  await prisma.role.upsert({
    where: { name: 'editor' },
    create: { name: 'editor', label: '编辑者' },
    update: {},
  });
  await prisma.role.upsert({
    where: { name: 'viewer' },
    create: { name: 'viewer', label: '查看者' },
    update: {},
  });

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '13800000000' },
    create: {
      phone: '13800000000',
      passwordHash: adminPassword,
      nickname: '管理员',
    },
    update: {},
  });

  // Assign admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });

  // Create embedding model config
  await prisma.embeddingModel.upsert({
    where: { id: 'default-embedding' },
    create: {
      id: 'default-embedding',
      name: '阿里云 Embedding',
      provider: 'aliyun',
      modelName: 'text-embedding-v3',
      dimension: 1536,
      apiKey: '',
      isDefault: true,
    },
    update: {},
  });

  // Create LLM provider config
  await prisma.llmProvider.upsert({
    where: { id: 'default-llm' },
    create: {
      id: 'default-llm',
      name: '阿里云通义千问',
      provider: 'aliyun',
      modelName: 'qwen-plus',
      apiKey: '',
      isDefault: true,
    },
    update: {},
  });

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
