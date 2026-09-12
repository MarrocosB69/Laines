import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/access-control';
import { ConteudosService } from './conteudos.service';
import { assertConteudoId } from './conteudo-upload';

@Injectable()
export class ConteudoUploadGuard implements CanActivate {
  constructor(private readonly conteudos: ConteudosService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ params: { id: string }; user: AuthenticatedUser }>();
    assertConteudoId(req.params.id);
    await this.conteudos.assertCanUpload(req.params.id, req.user);
    return true;
  }
}
