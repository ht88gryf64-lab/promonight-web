// Preload hook: resolve `server-only` imports to an empty shim so scripts
// in this directory can import files that guard themselves with
// `import 'server-only'`. Only affects the current Node process.
const path = require('path');
const Module = require('module');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'server-only') {
    return path.join(__dirname, '_server-only-shim.cjs');
  }
  return originalResolve.call(this, request, ...rest);
};
