const child_process = require('child_process');

child_process.spawnSync(
  'npm install && npm run build',
  {shell: true, stdio: ['inherit', 'inherit', 'inherit']}
)

require('./lib/main')
