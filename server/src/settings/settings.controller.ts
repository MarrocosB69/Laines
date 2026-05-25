import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ADMIN_AREA_ROLES, ADMIN_ROLES } from '../common/domain/access.constants';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_AREA_ROLES)
  @Get('admin-console')
  getAdminConsoleSettings() {
    return this.settingsService.getAdminConsoleSettingsWithMeta();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch('admin-console')
  updateAdminConsoleSettings(
    @Req() req: { user?: { id: string; email?: string; role?: string; name?: string } },
    @Body() dto: UpdateAdminSettingsDto
  ) {
    return this.settingsService.upsertAdminConsoleSettings(dto, req.user);
  }
}
