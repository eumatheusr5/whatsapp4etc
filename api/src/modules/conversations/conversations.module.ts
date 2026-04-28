import { Module, Global, forwardRef } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { BaileysModule } from '../../baileys/baileys.module';

@Global()
@Module({
  imports: [forwardRef(() => BaileysModule)],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
