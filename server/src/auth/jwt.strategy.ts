import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { getEffectivePermissions } from '../common/domain/access.constants';
import { buildCapabilities } from './authorization';
import { RefreshTokensService } from './refresh-tokens.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokensService
  ) {
    const jwtSecret = String(config.get('jwt.secret') || '').trim();
    if (!jwtSecret) {
      throw new UnauthorizedException('Configuracao JWT invalida.');
    }
    const configuredClockTolerance = Number(config.get('jwt.clockToleranceSeconds') || 5);
    const clockTolerance = Number.isFinite(configuredClockTolerance)
      ? Math.max(0, Math.floor(configuredClockTolerance))
      : 5;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      issuer: config.get('jwt.issuer'),
      audience: config.get('jwt.audience'),
      jsonWebTokenOptions: {
        clockTolerance
      }
    });
  }

  async validate(payload: { sub: string; email: string; role: string; name: string; sv?: number; typ?: string; sid?: string }) {
    if (payload?.typ !== 'access') {
      throw new UnauthorizedException('Credencial invalida para esta operacao.');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Sessao invalida.');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || (user.status || '').toLowerCase() !== 'ativo') {
      throw new UnauthorizedException('Sessao invalida.');
    }
    const tokenSessionVersion = Number(payload?.sv);
    const currentSessionVersion = Number(user.sessionVersion || 1);
    if (!Number.isFinite(tokenSessionVersion) || tokenSessionVersion !== currentSessionVersion) {
      throw new UnauthorizedException('Sessao revogada. Faca login novamente.');
    }
    if (!payload.sid || !(await this.refreshTokens.isFamilyActive(user.id, payload.sid))) {
      throw new UnauthorizedException('Sessao encerrada. Faca login novamente.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      sessionVersion: currentSessionVersion,
      cpf: user.cpf || null,
      dataNascimento: user.dataNascimento || null,
      matricula: user.matricula || null,
      periodo: user.periodo || null,
      supervisorId: user.supervisorId || null,
      supervisorNome: user.supervisorNome || null,
      profissionalId: user.profissionalId || null,
      profissionalNome: user.profissionalNome || null,
      diretoria: user.diretoria || null,
      curso: user.curso || null,
      projetoId: user.projetoId || null,
      projetoNome: user.projetoNome || null,
      telefone: user.telefone || null,
      crn: user.crn || null,
      conselhoTipo: user.conselhoTipo || null,
      conselhoNumero: user.conselhoNumero || null,
      departamento: user.departamento || null,
      nivelAcesso: user.nivelAcesso || null,
      coordAtendimento: Boolean(user.coordAtendimento),
      mustChangePassword: Boolean(user.mustChangePassword),
      permissions: getEffectivePermissions(user),
      // Projecao do contrato de autorizacao (UPD-12): a interface consome, nao decide.
      capabilities: buildCapabilities({
        id: user.id,
        role: user.role,
        diretoria: user.diretoria || null,
        permissions: getEffectivePermissions(user),
        coordAtendimento: Boolean(user.coordAtendimento),
        projetoId: user.projetoId || null,
        supervisorId: user.supervisorId || null,
        crn: user.crn || null,
        conselhoTipo: user.conselhoTipo || null,
        conselhoNumero: user.conselhoNumero || null
      })
    };
  }
}
