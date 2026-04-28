import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';

@Module({
  providers: [InstancesService],
  controllers: [InstancesController],
  exports: [InstancesService],
})
export class InstancesModule {}
