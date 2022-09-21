import './init.js';

/* All the code included in this repository is intended as example only and should NOT be
 * adopted for use in production software without first undergoing full review and rigorous 
 * testing. This code is provided on an "AS-IS" basis without warranty of any kind, either 
 * express or implied, including without limitation any implied warranties of condition, 
 * uninterrupted use, merchantability, fitness for a particular purpose, or non-infringement.
 * The details of your application or component, the architecture of the host-application, 
 * and your target browser support, among many other things, and may require you to modify 
 * this reference code. Issues regarding these code examples should be submitted through GitHub.
 *
 * This is intended for remote use-case (see README.md). If your micro-frontend is packaged as a
 * dependency (npm, yarn) and built, bundled and deployed into [host] application as part of [host]
 * team's build process, please checkout methods/lib-* and methods/3plib-*
 */

window.SENTRY_INIT_METHODS["simple-remote"] = {
  
  // no wrapping inside [micro] is necessary
  micro_internal_wrapper: null, 
  
  // This goes into [host] application's code
  init_host_sentry:  function(tracing, debug, initialScope) {

               var get_micro_instances = function() {
                  let wsm = window.__SENTRY_MICRO__;
                  if (wsm === undefined || wsm.instances === undefined) {
                    return [];
                  }
                  return wsm.instances;
                } 

                Sentry.init({
                    dsn: HOST_DSN,
                    release: HOST_RELEASE,
                    debug: debug,
                    integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                    tracesSampleRate: 1.0,
                    initialScope: initialScope,
                    beforeSend: (event, hint) => {

                      let stack = hint.originalException.stack || hint.syntheticException.stack;
                      let micros = get_micro_instances();

                      for (const iname in micros) {
                        if (stack.match(micros[iname].matcher)) {
                          event.release = micros[iname].client._options.release;
                          micros[iname].client.captureEvent(event);
                          return null;
                        }
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
    if (window.__SENTRY_MICRO__ === undefined) {
      window.__SENTRY_MICRO__ = {instances: {}};
    }
    
    /* TODO replace "micro" with unique module name, e.g. "CheckoutComponent" */
    window.__SENTRY_MICRO__.instances["micro"] = { 
      // [micro] team supplies matcher based on origin URL and filename of their component
      matcher: /http[s]?:\/\/(localhost:8000|(www\.)?sentry-micro-frontend\.net)\/micro.js/,
      client: new Sentry.BrowserClient({
        dsn: MICRO_DSN,
        release: MICRO_RELEASE,
        debug: debug, /* remove this (sandbox) */
        transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport)
      })
    };
  }
};
