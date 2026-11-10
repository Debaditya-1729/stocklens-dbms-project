/** Keep PGlite's WASM and extension archive on disk instead of bundling them. */
export default {devIndicators:false,serverExternalPackages:['@electric-sql/pglite','pg'],outputFileTracingRoot:process.cwd()};
