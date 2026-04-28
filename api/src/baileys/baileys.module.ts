import { Module, Global, forwardRef } from '@nestjs/common';
import { SessionManager } from './session-manager';
import { EventHandlersService } from './event-handlers.service';
import { ContactsModule } from '../modules/contacts/contacts.module';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { MediaModule } from '../modules/media/media.module';
import { TranscriptionModule } from '../modules/transcription/transcription.module';

@Global()
@Module({
  imports: [
    forwardRef(() => ContactsModule),
    forwardRef(() => ConversationsModule),
    forwardRef(() => MediaModule),
    forwardRef(() => TranscriptionModule),
  ],
  providers: [SessionManager, EventHandlersService],
  exports: [SessionManager],
})
export class BaileysModule {}
