import { runRestartInject } from './restart-inject-worker.js';

runRestartInject(process.argv.slice(2)).then(code => {
  process.exitCode = code;
}).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
