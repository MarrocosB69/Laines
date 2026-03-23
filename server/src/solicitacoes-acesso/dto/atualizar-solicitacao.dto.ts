import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { SOLICITACAO_STATUS } from '../../common/domain/access.constants';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

export class AtualizarSolicitacaoDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsIn([...SOLICITACAO_STATUS])
  status?: string;

  @IsOptional()
  @IsString()
  diretoria?: string;

  @IsOptional()
  @IsUUID()
  projetoId?: string;

  @IsOptional()
  @IsString()
  projetoNome?: string;
}
