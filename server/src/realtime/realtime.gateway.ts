import { Injectable } from '@nestjs/common';
import {
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { UsersService } from '../users/users.service';
import { normalizeRole } from '../auth/access-control';

const isLocalhostOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
};

const resolveRuntimeCors = () => {
  const allowedOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    allowedOrigins,
    allowAllOrigins: allowedOrigins.includes('*'),
    isProduction: String(process.env.NODE_ENV || 'development') === 'production'
  };
};

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (error: Error | null, allow?: boolean) => void) => {
      const { allowedOrigins, allowAllOrigins, isProduction } = resolveRuntimeCors();
      if (
        !origin
        || allowAllOrigins
        || allowedOrigins.includes(origin)
        || (!isProduction && isLocalhostOrigin(origin))
      ) {
        callback(null, true);
        return;
      }
      callback(new Error('Origem nao permitida.'), false);
    },
    credentials: true
  }
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly allowedOrigins: string[];
  private readonly allowAllOrigins: boolean;
  private readonly isProduction: boolean;
  private readonly broadcastRoles: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {
    this.allowedOrigins = String(this.config.get('corsOrigin') || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    this.allowAllOrigins = this.allowedOrigins.includes('*');
    this.isProduction = String(this.config.get('nodeEnv') || 'development') === 'production';
    this.broadcastRoles = String(this.config.get('realtime.broadcastRoles') || '')
      .split(',')
      .map((role) => normalizeRole(role))
      .filter(Boolean);
  }

  afterInit(_server: Server) {
    this.server.use(async (socket, next) => {
      const origin = String(socket.handshake.headers.origin || '');
      if (
        origin &&
        !this.allowAllOrigins &&
        this.allowedOrigins.length > 0 &&
        !this.allowedOrigins.includes(origin) &&
        !(!this.isProduction && isLocalhostOrigin(origin))
      ) {
        next(new Error('Origem nao permitida.'));
        return;
      }

      const authHeader = socket.handshake.headers.authorization;
      const authToken = typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : '';
      const rawToken = authToken || (typeof authHeader === 'string' ? authHeader : '');
      const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

      if (!token) {
        next(new Error('Token ausente.'));
        return;
      }

      try {
        const configuredClockTolerance = Number(this.config.get('jwt.clockToleranceSeconds') || 5);
        const clockTolerance = Number.isFinite(configuredClockTolerance)
          ? Math.max(0, Math.floor(configuredClockTolerance))
          : 5;
        const payload = this.jwtService.verify<{ sub: string; sv?: number }>(token, {
          issuer: this.config.get('jwt.issuer'),
          audience: this.config.get('jwt.audience'),
          clockTolerance
        });
        const user = await this.usersService.findById(payload.sub);
        if (!user || (user.status || '').toLowerCase() !== 'ativo') {
          next(new Error('Sessao invalida.'));
          return;
        }
        const tokenSessionVersion = Number(payload?.sv);
        const currentSessionVersion = Number(user.sessionVersion || 1);
        if (!Number.isFinite(tokenSessionVersion) || tokenSessionVersion !== currentSessionVersion) {
          next(new Error('Sessao revogada.'));
          return;
        }
        const role = normalizeRole(user.role);
        socket.data.user = { id: user.id, role };
        socket.join(`user:${user.id}`);
        if (role) {
          socket.join(`role:${role}`);
        }
        next();
      } catch {
        next(new Error('Token invalido.'));
      }
    });
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() payload: unknown) {
    return { event: 'pong', data: payload };
  }

  emit(event: string, data: unknown) {
    if (!this.server) return;
    if (this.broadcastRoles.length === 0) {
      this.server.emit(event, data);
      return;
    }
    this.broadcastRoles.forEach((role) => {
      this.server.to(`role:${role}`).emit(event, data);
    });
  }

  emitToUser(userId: string, event: string, data: unknown) {
    if (!this.server || !userId) return;
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
