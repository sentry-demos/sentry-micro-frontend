function get_script_src(version, min_js) {
  return `https://browser.sentry-cdn.com/${version}/bundle.tracing${min_js?".min":""}.js`;
}

if (window.SENTRY_INIT_METHODS === undefined) {
  window.SENTRY_INIT_METHODS = {};
};

export function default_host_init(tracing, debug, initialScope) {
    // No changes needed in [host] code - standard init()
    Sentry.init({ 
        dsn: HOST_DSN,
        release: HOST_RELEASE,
        debug: !(debug === undefined || debug === false), 
        integrations: tracing === undefined || tracing === false ? [] : [new Sentry.BrowserTracing() ],
        tracesSampleRate: 1.0,
        initialScope: initialScope
    });
  }
