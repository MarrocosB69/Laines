import { IsIn, IsOptional, IsString } from 'class-validator';
import { SOLICITACAO_CARGOS } from '../../common/domain/access.constants';

export class AprovarSolicitacaoDto {
  @IsOptional()
  @IsString()
  @IsIn([...SOLICITACAO_CARGOS])
  cargoSolicitado?: string;
}
