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
import { LoginAttempt } from './login-attempt.entity';
import { RefreshTokensService } from './refresh-tokens.service';
import { RefreshToken } from './refresh-token.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    UsersModule,
    SettingsModule,
    ObservabilityModule,
    TypeOrmModule.forFeature([RefreshToken, LoginAttempt]),
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
