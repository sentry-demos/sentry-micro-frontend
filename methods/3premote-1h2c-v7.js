import './init.js';

/* This is the recommended method.
 *
 * Tested with @sentry/browser v7.11.1, it might work with v6 but hasn't been tested
 *
 * This is intended for remote use-case (see README.md). If your micro-frontend is packaged as a
 * dependency (npm, yarn) and built, bundled and deployed into [host] application as part of [host]
 * team's build process, please checkout methods/lib-* and methods/3plib-*
 */

window.SENTRY_INIT_METHODS["remote-1h2c-v6v7"] = {
  
  // no wrapping inside [micro] is necessary
  micro_internal_wrapper: null, 
  
  // This goes into [host] application's code
  init_host_sentry: null,

  /* This goes into [micro]'s code */
  init_micro_sentry: function(tracing, debug, initialScope) /* these args needed only for the sandbox */ {
  
    if (_is_sentry_initialized()) {
      _patch_micro_sentry();
      console.log("[micro] Sentry already initialized, patching global handlers");
    } else {
      console.log("[micro] Sentry is not initialized yet, giving it a chance. Setting up temporary queueing handlers that will become pass-through once Sentry is initialized.");
      _setup_queueing_passthru_handlers();

      var _on_host_sentry_initialized = function() {
        if (_is_sentry_initialized()) {
          _patch_micro_sentry();
        } else {
          _normal_sentry_init();
        }
        _process_queued_errors();
      }
      document.addEventListener("DOMContentLoaded", _on_host_sentry_initialized);
    }

    var _is_sentry_initialized = function() {
      return "__SENTRY__" in window;
    }
    var _sentry_error_queue = [];

    var _setup_queueing_passthru_handlers = function() {
      let old_handler_err = global.onerror;
      let err_handler = function(...args) {
        // Sentry, once initialized will chain this function in a similar manner to how we
        // chain old hanlder below. At that point we start acting as pass-through
        // See https://github.com/getsentry/sentry-javascript/blob/9b7f43246e75934c5b689f04147be788d3589fc2/packages/utils/src/instrument.ts#L607
        if (window.onerror === err_handler) {
          _sentry_error_queue.push(['error', args]);
        } 
        if (old_handler_err) {
          return old_handler_err.apply(window, args);
        }
        return true;
      }
      window.onerror = err_handler;

      let old_handler_rej = global.onunhandledrejection;
      let rej_handler = function(...args) {
        if (window.onunhandledrejection === rej_handler) {
          // potentially could clear "DOMContentLoaded" here and call _on_host_sentry_initialized
          _sentry_error_queue.push(['unhandledrejection', args]);
        }
        if (old_handler_rej) {
          return old_handler_rej.apply(window, args);
        }
        return true;
      }
      window.onunhandledrejection = rej_handler;
    }

    var _process_queued_errors = function() {
      for (const [type, args] of _sentry_error_queue) {
        if (type === 'error') {
          window.onerror.apply(window,...args);
        } else {
          window.onunhandledrejection.apply(window,...args);
        }
      }
    }

    var _patch_micro_sentry = function() {
      _init_micro_client();
      
      let newold_handler_err = global.onerror;

      let patch_err_handler = function(...args) {

        let wsm = window.__SENTRY_MICRO__;
        let [msg, url, line, column, error] = args;
        let stack = error.stack;
        // We're skipping all this stuff:
        // https://github.com/getsentry/sentry-javascript/blob/249e64d02efc4ae60626aaaba892593616c9dec9/packages/browser/src/integrations/globalhandlers.ts#L82

        for (const iname in micros) {
          if (stack.match(micros[iname].matcher)) {
            event.release = micros[iname].client._options.release;
            micros[iname].client.captureException(error);
            return true;
          }
        }
        return newold_handler_err.apply(window, args);
      }

      window.onerror = patch_err_handler;
      window.onunhandledrejection = patch_err_handler;
    }

    var _init_micro_client = function () {
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

    var _normal_sentry_init = function() {
      Sentry.init({
          dsn: MICRO_DSN,
          release: MICRO_RELEASE,
          debug: debug, 
          integrations: tracing ? [new Sentry.BrowserTracing()] : [],
          tracesSampleRate: 1.0,
          initialScope: initialScope
      });
    }

  }
};
