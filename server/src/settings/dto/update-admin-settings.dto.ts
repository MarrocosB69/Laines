import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

const SETTINGS_MODES = ['manual', 'reset'] as const;

export class UpdateAdminSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['pt-BR', 'en-US', 'es-ES'])
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn(['America/Sao_Paulo', 'America/New_York', 'Europe/London'])
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
  dateFormat?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyReports?: boolean;

  @IsOptional()
  @IsBoolean()
  systemAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorAuth?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  sessionTimeout?: number;

  @IsOptional()
  @IsBoolean()
  showSensitiveData?: boolean;

  @IsOptional()
  @IsBoolean()
  compactMode?: boolean;

  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsBoolean()
  animationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn([...SETTINGS_MODES])
  mode?: string;
}
