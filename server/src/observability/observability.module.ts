import { Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  providers: [ObservabilityService, RolesGuard],
  controllers: [ObservabilityController],
  exports: [ObservabilityService]
})
export class ObservabilityModule {}
