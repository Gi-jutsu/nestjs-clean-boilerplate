import { Server } from 'http';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrap } from '../../../main.js';

describe('HealthCheckHttpController', () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(() => {
    server.close();
  });

  // Based on https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check#name-releaseid
  it('should ...', async () => {
    const response = await supertest(server).get('/health-check');

    expect(response.status).toEqual(200);
    expect(response.body).toMatchObject({
      status: 'pass',
      checks: {
        postgresql: {
          status: 'pass',
        },
        uptime: [
          {
            componentType: 'system',
            observedValue: expect.any(Number), // Uptime is dynamic, so we use expect.any(Number)
            observedUnit: 's',
            status: 'pass',
          },
        ],
      },
    });
  });
});
