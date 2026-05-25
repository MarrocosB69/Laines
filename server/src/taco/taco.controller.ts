import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ADMIN_ROLES } from '../common/domain/access.constants';
import {
  TacoCalculoItem,
  TacoService,
  UpsertTacoPayload
} from './taco.service';

class BuscarTacoQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  grupo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class CalcularTacoItemDto implements TacoCalculoItem {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  alimentoId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  quantidadeGramas!: number;
}

class CalcularTacoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalcularTacoItemDto)
  items!: CalcularTacoItemDto[];
}

class UpsertTacoDto implements UpsertTacoPayload {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  codigo!: number;

  @IsString()
  descricao!: string;

  @IsString()
  grupo!: string;

  @IsOptional() @Type(() => Number) @IsNumber() umidade?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() energiaKcal?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() energiaKj?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() proteina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() lipidios?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() colesterol?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() carboidrato?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() fibra?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() cinzas?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() calcio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() magnesio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() manganes?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() fosforo?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ferro?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() sodio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() potassio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() cobre?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() zinco?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() retinol?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() tiamina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() riboflavina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() piridoxina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() niacina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() vitaminaC?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() vitaminaD?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() vitaminaE?: number | null;
}

class UpdateTacoDto implements Partial<UpsertTacoPayload> {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) codigo?: number;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() grupo?: string;
  @IsOptional() @Type(() => Number) @IsNumber() umidade?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() energiaKcal?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() energiaKj?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() proteina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() lipidios?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() colesterol?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() carboidrato?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() fibra?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() cinzas?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() calcio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() magnesio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() manganes?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() fosforo?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ferro?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() sodio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() potassio?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() cobre?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() zinco?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() retinol?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() tiamina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() riboflavina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() piridoxina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() niacina?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() vitaminaC?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() vitaminaD?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() vitaminaE?: number | null;
}

@UseGuards(JwtAuthGuard)
@Controller('taco')
export class TacoController {
  constructor(private readonly tacoService: TacoService) {}

  @Get('buscar')
  buscar(@Query() query: BuscarTacoQueryDto) {
    return this.tacoService.buscar({
      query: query.q,
      grupo: query.grupo,
      limite: query.limit
    });
  }

  @Post('calcular')
  calcular(@Body(new ParseArrayPipe({ items: CalcularTacoItemDto, optional: true })) body: CalcularTacoItemDto[] | undefined) {
    if (Array.isArray(body)) {
      return this.tacoService.calcularNutrientes(body);
    }
    return this.tacoService.calcularNutrientes([]);
  }

  @Post('calcular-lote')
  calcularLote(@Body() dto: CalcularTacoDto) {
    return this.tacoService.calcularNutrientes(dto.items || []);
  }

  @Get(':id')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.tacoService.buscarPorId(id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post()
  create(@Body() dto: UpsertTacoDto) {
    return this.tacoService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTacoDto) {
    return this.tacoService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tacoService.remove(id);
  }
}
