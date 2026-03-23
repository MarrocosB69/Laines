import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ObservabilityService } from '../../observability/observability.service';

type HttpPayload = {
  message?: string | string[];
  error?: string;
  [key: string]: unknown;
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);
  constructor(private readonly observability?: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = String(
      (request as Request & { requestId?: string }).requestId
      || request.headers['x-request-id']
      || ''
    ).trim();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttpException
      ? (exception.getResponse() as string | HttpPayload)
      : null;

    const details =
      payload && typeof payload === 'object' && Array.isArray(payload.message)
        ? payload.message.map((item) => String(item))
        : undefined;

    const message = this.resolveMessage(payload, status);
    const error = this.resolveError(payload, status);

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception: ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }
    this.observability?.recordError({
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      method: request.method,
      statusCode: status,
      message,
      requestId: requestId || undefined
    });

    response.status(status).json({
      statusCode: status,
      message,
      error,
      details,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      requestId: requestId || undefined
    });
  }

  private resolveMessage(payload: string | HttpPayload | null, status: number): string {
    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }
    if (payload && typeof payload === 'object') {
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
      if (Array.isArray(payload.message) && payload.message.length > 0) {
        return payload.message.map((item) => String(item)).join(' ');
      }
    }
    if (status >= 500) {
      return 'Erro interno do servidor.';
    }
    return 'Nao foi possivel concluir a requisicao.';
  }

  private resolveError(payload: string | HttpPayload | null, status: number): string {
    if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
      return payload.error;
    }
    return HttpStatus[status] || 'Error';
  }
}
