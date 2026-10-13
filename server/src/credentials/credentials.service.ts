import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

const INVALID_LINK = 'Link invalido ou expirado. Solicite um novo link.';
const TTL_MS = 15 * 60 * 1000;

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(private readonly dataSource: DataSource, private readonly mail: MailService) {}

  async issue(userId: string): Promise<{ delivery: 'sent' | 'unavailable' }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(User).findOne({
        where: { id: userId }, lock: { mode: 'pessimistic_write' }
      });
      if (!current || current.deletedAt || current.status !== 'ativo') return null;
      // Only an administrator-controlled contact is used; never a request-supplied destination.
      if (!current.recoveryEmail) return null;
      await manager.query(`INSERT INTO password_recovery_tokens
        (user_id, token_hash, expires_at, session_version)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash,
          expires_at = EXCLUDED.expires_at, session_version = EXCLUDED.session_version`,
      [current.id, tokenHash, new Date(Date.now() + TTL_MS), current.sessionVersion]);
      return current;
    });
    if (!user) return { delivery: 'unavailable' };
    try {
      const sent = await this.mail.sendAccountLink({
        toEmail: user.recoveryEmail!, nome: user.name, loginEmail: user.email, token,
        activation: Boolean(user.mustChangePassword)
      });
      if (sent) return { delivery: 'sent' };
    } catch {
      this.logger.error('Falha na entrega do link de acesso. Verifique o servico de email.');
    }
    await this.dataSource.query('DELETE FROM password_recovery_tokens WHERE token_hash = $1', [tokenHash]);
    return { delivery: 'unavailable' };
  }

  async consume(token: string, newPassword: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new BadRequestException(INVALID_LINK);
    if (typeof newPassword !== 'string' || newPassword.length < 8
      || Buffer.byteLength(newPassword, 'utf8') > 72
      || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new BadRequestException('Senha deve ter de 8 a 72 bytes, maiuscula, minuscula e numero.');
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.dataSource.transaction(async (manager) => {
      const [candidate] = await manager.query(
        'SELECT user_id FROM password_recovery_tokens WHERE token_hash = $1', [tokenHash]);
      if (!candidate) throw new BadRequestException(INVALID_LINK);
      // Same lock order as issue: user, then token. Concurrent consumption has one winner.
      const user = await manager.getRepository(User).findOne({
        where: { id: candidate.user_id }, lock: { mode: 'pessimistic_write' }
      });
      const [challenge] = await manager.query(
        'SELECT * FROM password_recovery_tokens WHERE token_hash = $1 FOR UPDATE', [tokenHash]);
      if (!user || user.deletedAt || user.status !== 'ativo' || !challenge
        || new Date(challenge.expires_at).getTime() <= Date.now()
        || Number(challenge.session_version) !== Number(user.sessionVersion)) {
        throw new BadRequestException(INVALID_LINK);
      }
      const localPart = user.email.split('@')[0].toLowerCase();
      if (localPart.length >= 4 && newPassword.toLowerCase().includes(localPart)) {
        throw new BadRequestException('A senha nao deve conter seu identificador de login.');
      }
      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        throw new BadRequestException('A nova senha deve ser diferente da senha atual.');
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await manager.getRepository(User).update(user.id, {
        passwordHash, tempPassword: null, mustChangePassword: false,
        passwordUpdatedAt: new Date(), sessionVersion: Number(user.sessionVersion) + 1
      });
      await manager.query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
      await manager.query('DELETE FROM password_recovery_tokens WHERE user_id = $1', [user.id]);
      return user.id;
    });
  }
}
