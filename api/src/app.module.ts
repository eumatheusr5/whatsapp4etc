import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './modules/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { BaileysModule } from './baileys/baileys.module';
import { InstancesModule } from './modules/instances/instances.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { MediaModule } from './modules/media/media.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { PushModule } from './modules/push/push.module';
import { StatsModule } from './modules/stats/stats.module';
import { UsersModule } from './modules/users/users.module';
import { TagsModule } from './modules/tags/tags.module';
import { QuickRepliesModule } from './modules/quick-replies/quick-replies.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 60 },
    ]),
    AuthModule,
    RealtimeModule,
    BaileysModule,
    InstancesModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    MediaModule,
    TranscriptionModule,
    OutboxModule,
    PushModule,
    StatsModule,
    UsersModule,
    TagsModule,
    QuickRepliesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
