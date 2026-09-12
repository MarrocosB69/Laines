import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PublicService } from './public.service';
import { InscricaoPublicaDto } from './dto/inscricao-publica.dto';
import { extractClientIp } from '../common/request-ip';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('stats')
  getStats() {
    return this.publicService.getPublicStats();
  }

  @Post('inscricao')
  criarInscricao(@Req() req: Request, @Body() dto: InscricaoPublicaDto) {
    const ip = extractClientIp(req);
    return this.publicService.criarInscricao(dto, ip);
  }
}
