import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { RolesGuard } from '../auth/roles.guard';
import { SettingsController } from './settings.controller';
import { SystemSetting } from './settings.entity';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting]), AuditoriaModule],
  providers: [SettingsService, RolesGuard],
  controllers: [SettingsController],
  exports: [SettingsService]
})
export class SettingsModule {}
