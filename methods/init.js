if (window.SENTRY_INIT_METHODS === undefined) {
  window.SENTRY_INIT_METHODS = {};
};

export function default_host_init(tracing, debug, initialScope, trace_propagation_targets) {
    // No changes needed in [host] code - standard init()
    Sentry.init({ 
        dsn: HOST_DSN,
        release: HOST_RELEASE,
        debug: !(debug === undefined || debug === false), 
        integrations: tracing === undefined || tracing === false ? [] : [new Sentry.BrowserTracing({
          tracePropagationTargets: trace_propagation_targets 
        })],
        tracesSampleRate: 1.0,
        initialScope: initialScope
    });
  }
