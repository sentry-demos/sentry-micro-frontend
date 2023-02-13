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
 * THIS METHOD DOESN'T WORK
 *
 * It's intended as illustration of what doesn't work.
 *
 * It will not correctly route [micro] errors thrown outside of the wrapped 
 * initialization code, i.e. anything in an event handler or Promise 
 * (unless you manually wrap every single event handler funciton, async callback, etc.)
 */

window.SENTRY_INIT_METHODS["lib-1h2c-wrap-v6"] = {

  micro_internal_wrapper: function(micro_init_callback) {
    try {
      micro_init_callback();
    } catch (e) {
      e._sentry_instance = "micro";
      throw e;
    }
  },

  init_host_sentry:  function(tracing, debug, initialScope) {
    Sentry.init({
      dsn: HOST_DSN,
      release: HOST_RELEASE,
      debug: debug, /* remove this (sandbox) */
      integrations: tracing ? [new Sentry.BrowserTracing()] : [], /* remove */
      tracesSampleRate: 1.0,
      initialScope: initialScope, /* remove */

      beforeSend: (event, hint) => {
        
        let inst;
        if (hint.originalException !== undefined) {
          inst = hint.originalException._sentry_instance;
        }
        if (inst !== undefined) {
          let wsm = window.__SENTRY_MICRO__;
          if (wsm === undefined || wsm.instances === undefined || !inst in wsm.instances) {
            return event;
          }
          wsm.instances[inst].client.captureEvent(event);
          return null;
        }
        return event;
      }
    });
  },

  init_micro_sentry: function(tracing, debug, initialScope) {
    if (window.__SENTRY_MICRO__ === undefined) {
      window.__SENTRY_MICRO__ = {instances: {}};
    }

    window.__SENTRY_MICRO__.instances["micro"] = {
      client: new Sentry.BrowserClient({
        dsn: MICRO_DSN,
        release: MICRO_RELEASE,
        debug: debug, /* remove this (sandbox) */
        transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport),
        integrations: []
      })
    }
  }
};

