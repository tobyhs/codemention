const child_process = require('child_process');
const process = require('process');

process.chdir(__dirname);

child_process.execSync(
  'npm install && npm run build',
  {stdio: ['inherit', 'inherit', 'inherit']}
)

require('./lib/main')
