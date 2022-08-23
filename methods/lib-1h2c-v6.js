import './init.js';

/* This is the recommended method.
 *
 * Tested only with @sentry/browser v6.19.6 but will likely work with v7 as well 
 */

window.SENTRY_INIT_METHODS["lib-1h2c-v6"] = {
  
  // no wrapping inside [micro] is necessary
  micro_internal_wrapper: null, 
  
  // This goes into [host] application's code
  init_host_sentry:  function(tracing, debug, initialScope) {
                Sentry.init({
                    dsn: HOST_DSN,
                    release: HOST_RELEASE,
                    debug: debug,
                    integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                    tracesSampleRate: 1.0,
                    initialScope: initialScope,
                    beforeSend: (event, hint) => {
                      /* TODO replace with regex that identifies micro-frontend's code based on 
                       * stacktrace, using filename or unique name of micro's top-level function.
                       *
                       * Because the team which owns [micro] has no control of [host] application's
                       * build process, how its sources are transformed and composed, the [host] team
                       * should be responsible for implementing this.
                       *
                       * For this to work the [host] team will most likely need to modify their build
                       * process to preserve information necessary to identify [micro]'s code.
                       */
                      let MICRO_STACK_REGEX = /\/micro(\.min)?\.js/; 

                      let stack = hint.originalException.stack || hint.syntheticException.stack;
                      if (stack.match(MICRO_STACK_REGEX)) {
                        event.release = window.SentryMicroClient._options.release;
                        window.SentryMicroClient.captureEvent(event);

                        return null;
                      }
                      return event;
                    }
                });
              },

  /* This goes into [micro]'s code
   *
   * NOTE: This relies on [host] having Sentry. If not every [host] consuming [micro] has Sentry,
   * you will need to check if window.__SENTRY__ exists and, if it doesn't, call Sentry.init()
   * yourself instead of creating this 2nd client. Also, it may be best to check that once again 
   * on DOMContentLoaded in case [host] decided to initilize [micro] module before intializing
   * its Sentry.
   */
  init_micro_sentry: function(tracing, debug, initialScope) {
    window.SentryMicroClient = new Sentry.BrowserClient({
      dsn: MICRO_DSN,
      release: MICRO_RELEASE,
      debug: debug,
      transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport)
    });
  }
};
