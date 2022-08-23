import './init.js';

window.SENTRY_INIT_METHODS["naive"] = {
  init_host_sentry:  function(tracing, debug) {
                Sentry.init({
                    dsn: HOST_DSN,
                    release: HOST_RELEASE,
                    debug: debug,
                    integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                    tracesSampleRate: 1.0,
                });
              },
  init_micro_sentry: function(tracing, debug) {
                Sentry.init({
                  /* This is DSN for [micro], different from [host] DSN */
                  dsn: MICRO_DSN,
                  release: MICRO_RELEASE,
                  debug: debug,
                  integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                  tracesSampleRate: 1.0,
                });
              }
};

