import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CredentialsService } from './credentials.service';

@Module({ imports: [MailModule], providers: [CredentialsService], exports: [CredentialsService] })
export class CredentialsModule {}
