import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { RefreshTokensService } from '../auth/refresh-tokens.service';
import { hasTeamScopedAccess, normalizeRole } from '../auth/access-control';
import { ADMIN_ROLES, normalizeDiretoria } from '../common/domain/access.constants';

const isLocalOrigin = (origin: string) => {
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); }
  catch { return false; }
};
const originAllowed = (origin: string, origins: string[], production: boolean) =>
  !origin || origins.includes(origin) || (!production && (origins.includes('*') || isLocalOrigin(origin)));

@WebSocketGateway({ cors: {
  origin: (origin: string, callback: (error: Error | null, allow?: boolean) => void) => {
    const allowed = originAllowed(origin, String(process.env.CORS_ORIGIN || '').split(',').map((item) => item.trim()), process.env.NODE_ENV === 'production');
    callback(allowed ? null : new Error('Origem nao permitida.'), allowed);
  },
  credentials: true
} })
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private sessionSweep?: ReturnType<typeof setInterval>;
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokensService,
    @InjectRepository(Paciente) private readonly pacientes: Repository<Paciente>
  ) {}

  afterInit(server: Server) {
    this.server = server;
    server.use(async (socket, next) => {
      const origins = String(this.config.get('corsOrigin') || '').split(',').map((item) => item.trim());
      if (!originAllowed(String(socket.handshake.headers.origin || ''), origins, this.config.get('nodeEnv') === 'production')) {
        next(new Error('Origem nao permitida.')); return;
      }
      const raw = socket.handshake.auth?.token || socket.handshake.headers.authorization;
      const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : '';
      try {
        const payload = this.jwtService.verify(token, {
          issuer: this.config.get('jwt.issuer'), audience: this.config.get('jwt.audience'), algorithms: ['HS256']
        });
        if (payload.typ !== 'access' || !payload.sub || !payload.sid || !Number.isFinite(payload.exp)) throw new Error();
        socket.data.session = { userId: payload.sub, version: payload.sv, familyId: payload.sid, expiresAt: payload.exp * 1000 };
        if (!(await this.activeUser(socket))) throw new Error();
        next();
      } catch { next(new Error('Sessao invalida. Faca login novamente.')); }
    });
    this.sessionSweep = setInterval(() => {
      for (const socket of this.server.sockets.sockets.values()) {
        void this.activeUser(socket).then((user) => { if (!user) socket.disconnect(true); }).catch(() => socket.disconnect(true));
      }
    }, 5000);
    this.sessionSweep.unref();
  }

  handleConnection(socket: Socket) {
    const remaining = Number(socket.data.session?.expiresAt || 0) - Date.now();
    if (remaining <= 0) { socket.disconnect(true); return; }
    const timer = setTimeout(() => socket.disconnect(true), Math.min(remaining, 2147483647));
    timer.unref();
    this.expiryTimers.set(socket.id, timer);
    socket.once('disconnect', () => { clearTimeout(timer); this.expiryTimers.delete(socket.id); });
  }

  onModuleDestroy() {
    clearInterval(this.sessionSweep);
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.expiryTimers.clear();
  }

  private async activeUser(socket: Socket): Promise<User | null> {
    const session = socket.data.session;
    if (!session?.userId || !session.familyId || session.expiresAt <= Date.now()) return null;
    // Leitura atual por entrega: revogacao nao depende de salas/cache antigos.
    const user = await this.usersService.findById(session.userId);
    if (!user || user.deletedAt || user.status !== 'ativo' || user.mustChangePassword) return null;
    if (Number(user.sessionVersion || 1) !== Number(session.version)) return null;
    if (!(await this.refreshTokens.isFamilyActive(user.id, session.familyId))) return null;
    return user;
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() socket: Socket) {
    if (!(await this.activeUser(socket))) { socket.disconnect(true); return; }
    return { event: 'pong', data: { ok: true } };
  }

  private async canReceive(user: User, event: string, data: Record<string, any>): Promise<boolean> {
    const kind = event.split('.')[0];
    if (kind === 'notificacoes') return !!data.userId && user.id === data.userId;
    if (kind === 'tarefas') {
      const target = normalizeRole(data.assignedRole || '');
      if (!target) return false;
      return (ADMIN_ROLES as readonly string[]).includes(normalizeRole(user.role)) || target === 'todos'
        || target === normalizeRole(user.role) || target === normalizeDiretoria(user.diretoria)
        || (target === 'coord_atendimento' && !!user.coordAtendimento);
    }
    if (!['pacientes', 'agendamentos', 'avaliacoes'].includes(kind)) return false;
    const patientId = kind === 'pacientes' ? data.id : data.pacienteId;
    if (!patientId) return false;
    const patient = await this.pacientes.findOne({ where: { id: patientId }, withDeleted: event.endsWith('.deleted') });
    if (!patient) return false;
    const ids = [patient.alunoResponsavelId, patient.professorSupervisorId, ...(patient.equipeTecnicaIds || []), ...(patient.equipeMultiIds || [])];
    if (user.role === 'atleta') return kind !== 'avaliacoes' && patient.atletaUserId === user.id;
    if (ids.includes(user.id)) return true;
    if (hasTeamScopedAccess(user.role) && patient.alunoResponsavelId) {
      const student = await this.usersService.findById(patient.alunoResponsavelId);
      return !!student && !student.deletedAt && (student.supervisorId === user.id || student.profissionalId === user.id);
    }
    return false;
  }

  emit(event: string, data: unknown): Promise<void> {
    return this.deliver(event, data).catch(() => { this.logger.warn('Evento nao entregue: validacao de acesso indisponivel.'); });
  }

  emitToUser(userId: string, event: string, data: unknown): Promise<void> {
    // Enderecar uma sala nao substitui a autorizacao do objeto.
    return this.deliver(event, data, userId).catch(() => { this.logger.warn('Evento nao entregue: validacao de acesso indisponivel.'); });
  }

  private async deliver(event: string, data: unknown, targetUserId?: string) {
    if (!this.server || !data || typeof data !== 'object') return;
    for (const socket of this.server.sockets.sockets.values()) {
      if (targetUserId && socket.data.session?.userId !== targetUserId) continue;
      const user = await this.activeUser(socket);
      if (!user) { socket.disconnect(true); continue; }
      if (await this.canReceive(user, event, data)) {
        // Recarregar via HTTP autorizado; nenhum registro/ID clinico trafega aqui.
        if (await this.activeUser(socket)) socket.emit(event, { invalidate: true });
        else socket.disconnect(true);
      }
    }
  }
}
