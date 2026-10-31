import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'tests/mysql.integration.test.js'], { stdio: 'inherit', env: { ...process.env, MYSQL_INTEGRATION: '1' }, windowsHide: true });
process.exitCode = result.status ?? 1;
