import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('mail.enabled') === true;

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('mail.smtpHost'),
        port: this.config.get<number>('mail.smtpPort'),
        secure: false,
        auth: {
          user: this.config.get<string>('mail.smtpUser'),
          pass: this.config.get<string>('mail.smtpPass')
        }
      });
    }
  }

  async sendAccountLink(options: {
    toEmail: string; nome: string; loginEmail: string; token: string; activation: boolean;
  }): Promise<boolean> {
    if (!this.enabled || !this.transporter) return false;
    const appUrl = new URL(this.config.get<string>('mail.appUrl') || 'https://laines.facisa.ufrn.br');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname);
    if (appUrl.protocol !== 'https:' && !(local && appUrl.protocol === 'http:')) {
      throw new Error('APP_URL deve utilizar HTTPS.');
    }
    appUrl.pathname = `${appUrl.pathname.replace(/\/$/, '')}/recuperar-senha`;
    appUrl.search = '';
    appUrl.hash = `token=${options.token}`;
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]!));
    const action = options.activation ? 'Ativar acesso' : 'Redefinir senha';
    await this.transporter.sendMail({
      from: this.config.get<string>('mail.from') || 'LAINES <noreply@laines.ufrn.br>',
      to: options.toEmail,
      subject: `LAINES - ${action}`,
      text: `Ola, ${options.nome}!\nLogin: ${options.loginEmail}\n${action}: ${appUrl.href}\nEste link expira em 15 minutos e pode ser usado uma vez. Se nao solicitou, ignore esta mensagem.`,
      html: `<p>Ola, ${escape(options.nome)}!</p><p>Login: ${escape(options.loginEmail)}</p><p><a href="${escape(appUrl.href)}">${action}</a></p><p>Este link expira em 15 minutos e pode ser usado uma vez. Se nao solicitou, ignore esta mensagem.</p>`
    });
    return true;
  }
}
