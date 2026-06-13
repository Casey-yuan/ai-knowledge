import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class IngestionService {
  constructor(@InjectQueue('ingestion') private ingestionQueue: Queue) {}

  async enqueueDocument(documentId: string) {
    await this.ingestionQueue.add('process-document', { documentId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.ingestionQueue.getWaitingCount(),
      this.ingestionQueue.getActiveCount(),
      this.ingestionQueue.getCompletedCount(),
      this.ingestionQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }
}
