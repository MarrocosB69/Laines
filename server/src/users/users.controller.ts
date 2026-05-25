import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parsePagination } from '../common/pagination';
import {
  ADMIN_AREA_ROLES,
  ADMIN_ROLES
} from '../common/domain/access.constants';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_AREA_ROLES)
  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset,
      defaultLimit: 200
    });
    return this.usersService.findAll(
      parsedLimit,
      parsedOffset
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_AREA_ROLES)
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.usersService.findPublicById(id, true);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return user;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createWithTempPassword(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { id?: string } }
  ) {
    return this.usersService.remove(id, req.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id/reset-password')
  resetPassword(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.resetTemporaryPassword(id);
  }
}
