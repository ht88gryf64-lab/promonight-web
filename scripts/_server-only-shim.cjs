// Empty shim — replaces `server-only` package at runtime so Node scripts
// can import server modules without the SSR guard tripping.
module.exports = {};
