import './init.js';

/* All the code included in this repository is intended as example only and should NOT be
 * adopted for use in production software without first undergoing full review and rigorous 
 * testing. This code is provided on an "AS-IS" basis without warranty of any kind, either 
 * express or implied, including without limitation any implied warranties of condition, 
 * uninterrupted use, merchantability, fitness for a particular purpose, or non-infringement.
 * The details of your application or component, architecture of the host-application, and 
 * your target browser support, among many other things, may require you to modify this code.
 * Issues regarding these code examples should be submitted through GitHub.
 *
 * This is intended for library use-case (see README.md). If your micro-frontend is a remote
 * component deployed independently of the [host] application check out methods/remote-*
 */

window.SENTRY_INIT_METHODS["simple-lib"] = {
  
  // no wrapping inside [micro] is necessary
  micro_internal_wrapper: null, 
  
  // This goes into [host] application's code
  init_host_sentry:  function(tracing, debug, initialScope, trace_propagation_targets) {
                  Sentry.init({
                    dsn: HOST_DSN,
                    release: HOST_RELEASE,
                    debug: debug,
                    integrations: tracing ? [new Sentry.BrowserTracing({
                      tracePropagationTargets: trace_propagation_targets 
                    })] : [],
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
                      let MICRO_STACK_REGEX = /http[s]?:\/\/(localhost:8000|(www\.)?sentry-micro-frontend\.net)(\/.*)?\/micro(\.min)?\.js/;

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
    /* TODO replace with unique module name, e.g. SentryCheckoutComponentClient */
    window.SentryMicroClient = new Sentry.BrowserClient({ 
      dsn: MICRO_DSN,
      release: MICRO_RELEASE,
      debug: debug,
      transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport)
    });
  }
};
