import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { TrackService } from 'src/track/track.service';

@Injectable()
export class TrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TrackingInterceptor.name);

  constructor(private trackService: TrackService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    const trackId = process.env.PRODUCTION == 'true' && (await this.getTrackId(request));
    return next.handle().pipe(
      map((data) => ({
        ...data,
        ['track-id']: trackId,
      })),
    );
  }

  private async getTrackId(request: any) {
    try {
      const trackId = request.headers['track-id'] || request.params['track-id'] || request.body['track-id'];
      const entityTrack = await this.trackService.increment(trackId);
      return entityTrack.id;
    } catch (error) {
      this.logger.error(error);
      return;
    }
  }
}

export function addTrackIdToResponses(document: OpenAPIObject): OpenAPIObject {
  for (const [, pathObject] of Object.entries(document.paths)) {
    for (const [, operation] of Object.entries(pathObject)) {
      if (operation.responses) {
        for (const [, response] of Object.entries(operation.responses)) {
          const content = response['content'];
          if (content && content['application/json'] && content['application/json'].schema) {
            content['application/json'].schema.properties = {
              ...content['application/json'].schema.properties,
              ['track-id']: {
                type: 'string',
                example: '123',
                description: 'The track ID associated with the request',
              },
            };
          }
        }
      }
    }
  }
  return document;
}

export function addTrackIdToQueryParams(document: OpenAPIObject): OpenAPIObject {
  for (const [, pathObject] of Object.entries(document.paths)) {
    for (const [, operation] of Object.entries(pathObject)) {
      if (!operation.parameters) {
        operation.parameters;
      }

      operation.parameters.push({
        name: 'track-id',
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          example: '123',
          description: 'The track ID associated with the request',
        },
      });
    }
  }
  return document;
}

export function addTrackIdToHeaders(document: OpenAPIObject): OpenAPIObject {
  for (const [, pathObject] of Object.entries(document.paths)) {
    for (const [, operation] of Object.entries(pathObject)) {
      if (!operation.parameters) {
        operation.parameters = [];
      }

      operation.parameters.push({
        name: 'track-id',
        in: 'header',
        required: false,
        schema: {
          type: 'string',
          example: '123',
          description: 'The track ID associated with the request',
        },
      });
    }
  }
  return document;
}
