import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LoginAttemptsService } from './login-attempts.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { RefreshToken } from './refresh-token.entity';

@Module({
  imports: [
    UsersModule,
    ObservabilityModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
        signOptions: {
          expiresIn: config.get('jwt.expiresIn'),
          issuer: config.get('jwt.issuer'),
          audience: config.get('jwt.audience')
        }
      })
    })
  ],
  providers: [AuthService, JwtStrategy, LoginAttemptsService, RefreshTokensService],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
