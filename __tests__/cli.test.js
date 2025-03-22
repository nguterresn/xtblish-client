import { execSync } from 'child_process';

describe('CLI', () => {
  it('displays help when called with --help', () => {
    const output = execSync('node dist/index.js --help').toString();
    expect(output).toContain('xtblish CLI');
  });
});
