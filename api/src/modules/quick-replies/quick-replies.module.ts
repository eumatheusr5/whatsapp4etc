import { Module } from '@nestjs/common';
import { QuickRepliesService } from './quick-replies.service';
import { QuickRepliesController } from './quick-replies.controller';

@Module({
  controllers: [QuickRepliesController],
  providers: [QuickRepliesService],
  exports: [QuickRepliesService],
})
export class QuickRepliesModule {}
