import { Module, Global } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { TranscriptionWorker } from './transcription.worker';

@Global()
@Module({
  providers: [TranscriptionService, TranscriptionWorker],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
