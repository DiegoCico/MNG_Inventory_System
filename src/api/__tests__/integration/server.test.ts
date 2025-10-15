import request from 'supertest';
import app from '../../src/server';

/**
 * INTEGRATION TESTS - Server
 *
 */

describe('tRPC Routes', () => {
  it('GET /trpc/hello should return a hello message', async () => {
    const res = await request(app).get(`/trpc/hello.hello?input=${encodeURIComponent('{}')}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringMatching(/^Hello/i),
          }),
        }),
      }),
    );
  });

  it('GET / should return root API message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/API up/i);
  });
});
