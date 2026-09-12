import { ArrayMaxSize, IsArray, IsIn, IsString } from 'class-validator';
import { PERMISSIONS } from '../../common/domain/access.constants';

const VALID_PERMISSIONS = Object.values(PERMISSIONS);

export class SetPermissionsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsIn(VALID_PERMISSIONS, { each: true })
  permissions!: string[];
}
