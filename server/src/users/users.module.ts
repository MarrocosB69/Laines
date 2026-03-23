import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Projeto } from '../projetos/projeto.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesGuard } from '../auth/roles.guard';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Projeto]), ObservabilityModule],
  providers: [UsersService, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule]
})
export class UsersModule {}
