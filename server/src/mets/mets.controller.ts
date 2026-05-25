import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';
import { MetsCategoria, MetsIntensidade } from './mets.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ADMIN_ROLES } from '../common/domain/access.constants';
import {
  CalculateMetPayload,
  MetsService,
  UpsertMetPayload
} from './mets.service';

class ListMetsQueryDto {
  @IsOptional()
  @IsString()
  modalidade?: string;

  @IsOptional()
  @IsEnum(MetsCategoria)
  categoria?: MetsCategoria;
}

class CalculateMetDto implements CalculateMetPayload {
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  metValue!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pesoKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  duracaoHoras!: number;

  @IsString()
  nivelCompetitivo!: string;
}

class UpsertMetDto implements UpsertMetPayload {
  @IsString()
  modalidade!: string;

  @IsEnum(MetsCategoria)
  categoria!: MetsCategoria;

  @IsEnum(MetsIntensidade)
  intensidade!: MetsIntensidade;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  metValue!: number;

  @IsOptional()
  @IsString()
  fonte?: string;

  @IsOptional()
  @IsString()
  codigoAinsworth?: string | null;
}

class UpdateMetDto implements Partial<UpsertMetPayload> {
  @IsOptional()
  @IsString()
  modalidade?: string;

  @IsOptional()
  @IsEnum(MetsCategoria)
  categoria?: MetsCategoria;

  @IsOptional()
  @IsEnum(MetsIntensidade)
  intensidade?: MetsIntensidade;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  metValue?: number;

  @IsOptional()
  @IsString()
  fonte?: string;

  @IsOptional()
  @IsString()
  codigoAinsworth?: string | null;
}

@UseGuards(JwtAuthGuard)
@Controller('mets')
export class MetsController {
  constructor(private readonly metsService: MetsService) {}

  @Get()
  list(@Query() query: ListMetsQueryDto) {
    return this.metsService.list(query);
  }

  @Post('calcular')
  calcular(@Body() dto: CalculateMetDto) {
    return this.metsService.calcular(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.metsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post()
  create(@Body() dto: UpsertMetDto) {
    return this.metsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMetDto) {
    return this.metsService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.metsService.remove(id);
  }
}
