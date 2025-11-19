import { runExport } from '../src/routers/export';
import { spawn } from 'child_process';

// ---- Mock FS ----
jest.mock('fs', () => ({
  createWriteStream: () => ({
    write: () => {},
    end: () => {},
    on: (ev: string, cb: Function) => {
      if (ev === 'finish') cb();
    },
  }),
  chmodSync: () => {},
}));

// ---- Mock S3 ----
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(async () => ({
        Body: {
          pipe: (dest: any) => {
            dest.write('fake-script');
            dest.end();
          },
          on: jest.fn(),
        },
      })),
    })),
    GetObjectCommand: jest.fn(),
  };
});

// ---- Mock Python spawn ----
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: {
      on: (_ev: string, cb: Function) => cb('python-output'),
    },
    stderr: {
      on: jest.fn(),
    },
    on: (ev: string, cb: Function) => {
      if (ev === 'close') cb(0);
    },
  })),
}));

describe('runExport()', () => {
  it('returns both CSV outputs', async () => {
    const res = await runExport('team123');

    expect(res.success).toBe(true);
    expect(typeof res.csv2404).toBe('string');
    expect(typeof res.csvInventory).toBe('string');
    expect(res.csv2404).toContain('script,2404');
    expect(res.csvInventory).toContain('script,inventory');

    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('calls python twice', async () => {
    await runExport('xyz');
    expect(spawn).toHaveBeenCalledTimes(4);
  });
});
