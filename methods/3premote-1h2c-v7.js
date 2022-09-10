import './init.js';

/* This is the recommended method.
 *
 * Tested with @sentry/browser v7.11.1, it might work with v6 but hasn't been tested
 *
 * This is intended for remote use-case (see README.md). If your micro-frontend is packaged as a
 * dependency (npm, yarn) and built, bundled and deployed into [host] application as part of [host]
 * team's build process, please checkout methods/lib-* and methods/3plib-*
 */

window.SENTRY_INIT_METHODS["3premote-1h2c-v7"] = {
  
  micro_internal_wrapper: null, // no wrapping inside [micro] is necessary
  
  // This goes into [host] application's code
  init_host_sentry: function(tracing, debug, initialScope) {
    Sentry.init({ // No changes needed in [host] code - standard init()
        dsn: HOST_DSN,
        release: HOST_RELEASE,
        debug: debug, 
        integrations: tracing ? [new Sentry.BrowserTracing()] : [],
        tracesSampleRate: 1.0,
        initialScope: initialScope
    });
  },

  /* This goes into [micro]'s code */
  init_micro_sentry: function(tracing, debug, initialScope) /* these args needed only for the sandbox */ {
  
    var _sentry_error_queue = [];
    var _init_micro_complete = false;
    var _host_sentry_present = false;

    var _is_sentry_initialized = function() {
      // Loading Sentry SDK JS will set up window.__SENTRY__ but not create Hub or Client
      // which is done in init()
      return "__SENTRY__" in window && "hub" in window.__SENTRY__;
    }

    // Temporary hanlder that queues errors 
    // turns itself into a pass-through dummy once Sentry is initialized
    var _patch_queueing_temp_handler = function(eventType) {
      let onEventType = `on${eventType}`;
      let old_handler = window[onEventType];
      let handler = function(...args) {
        // Sentry, once initialized will chain this function in a similar manner to how we
        // chain old hanlder below. At that point we start acting as pass-through
        // See https://github.com/getsentry/sentry-javascript/blob/9b7f43246e75934c5b689f04147be788d3589fc2/packages/utils/src/instrument.ts#L607
        if (window[onEventType] === handler) {
          _sentry_error_queue.push([eventType, args]);
        } else {
          if (!_init_micro_complete) {
            // [host] Sentry already initialized but [micro] Client not set up yet
            // At this point 1 error has already been processed (potentially incorrectly) by [host] Sentry
            // Nothing we can do about it
            _sentry_error_queue.push([eventType, args]);
            _init_micro_sentry();
          }
        }
        if (old_handler) {
          return old_handler.apply(window, args);
        }
        return true;
      }
      window[onEventType] = handler;
    }

    var _process_queued_errors = function() {
      console.log(_sentry_error_queue.length > 0 ? "[micro] Processing any queued errors" : "[micro] No queued errors to process");
      for (const [type, args] of _sentry_error_queue) {
        if (_match_to_micro(...args)[0]) {
          if (type === 'error') {
            window.onerror.apply(window, args);
          } else {
            window.onunhandledrejection.apply(window, args);
          }
        }
      }
    }

    /* 
     * Checks if there is a matching micro, additionally extracting `error` out of args 
     * Takes same args as passed to window.onerror and window.onunhandledrejection
     *
     * Returns [micro, error] if error matches a micro, [null, error] otherwise
     */
    var _match_to_micro = function(...args) {
      let micros = window.__SENTRY_MICRO__.instances;
      let msg, url, line, column, error;
      if (args[0] && typeof args[0] === 'object' && 'constructor' in args[0] && args[0].constructor.name === 'PromiseRejectionEvent') {
        error = args[0].reason
      } else {
        [msg, url, line, column, error] = args;
      }
      if (error) {
        let stack = error.stack;
        for (const iname in micros) {
          if (stack.match(micros[iname].matcher)) {
            return [micros[iname], error];
          }
        }
      }
      return [null, error];
    }

    var _capture = function(micro, error) {
      // NOTE: we're skipping all this stuff:
      // https://github.com/getsentry/sentry-javascript/blob/249e64d02e/packages/browser/src/integrations/globalhandlers.ts#L82
      delete error.__sentry_captured__; // see (!_init_micro_complete) in queueing handlers
      micro.client.captureException(error);
    }

    var _patch_global_handler = function(eventType) {
      let onEventType = `on${eventType}`;
      let newold_handler = window[onEventType];
      let patch_handler = (old_handler) => {
        return (...args) => {
          let [micro, error] = _match_to_micro(...args);
          if (micro) {
            _capture(micro, error);
            return true;
          }
          return old_handler.apply(window, args);
        };
      }
      window[onEventType] = patch_handler(newold_handler);
    }


    var _wrap_callback = function(callback) {
      return function(...callback_args) {
        try {
          callback(...callback_args); // apply?
        } catch (e) {
          if (_host_sentry_present) {
            let [micro, error] = _match_to_micro(null, null, null, null, e);
            if (micro) {
              _capture(micro, error);
            } 
          }
          // captureException() sets error.__sentry_captured__ so won't be captured again by [host]
          throw e;
        }
      }
    }
    
    var _patch_prop = function(object, prop_name, factory) {
      let original = object[prop_name];
      let patched = factory(original);
      object[prop_name] = patched;
    };

    // patches function by wrapping callback (1st argument) with try-catch-captureException
    var _patch_set_callback_func = function(object, func_name) {
      _patch_prop(object, func_name, (original) => {
        return (...args) => { 
          let original_callback = args[0];
          args[0] = _wrap_callback(original_callback); 
          return original.apply(this, args);
        }
      });
    };

    var _patch_xhr = function() {
      if (!'XMLHttpRequest' in window) {
        return;
      }
      _patch_prop(XMLHttpRequest.prototype, 'send', (original) => {
        return (...args) => { 
          var xhr = this;
          var xhr_props = ['onload', 'onerror', 'onprogress', 'onreadystatechange'];
          xhr_props.forEach(prop => {
            if (prop in xhr && typeof xhr[prop] === 'function') {
              _patch_function(xhr, original_name);
            }
          });
          return original.apply(this, args);
        }
      });
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

    var _patch_all = function() {
      _patch_global_handler('error');
      _patch_global_handler('unhandledrejection');
      // See https://github.com/getsentry/sentry-javascript/blob/efd32f0f6/packages/browser/src/integrations/trycatch.ts#L86
      _patch_set_callback_func(window, 'setTimeout');
      _patch_set_callback_func(window, 'setInterval');
      _patch_set_callback_func(window, 'requestAnimationFrame');
      _patch_xhr();
    }
    
    /* --->  Entry point <--- */
    _init_micro_client();

    if (_is_sentry_initialized()) {
      _host_sentry_present = true;
      console.log("[micro] Sentry already initialized, patching global handlers");
      _patch_all();
    } else {
      console.log("[micro] Sentry is not initialized yet, giving it a chance.");
      console.log("[micro] .");
      _patch_queueing_temp_handler('error');
      _patch_queueing_temp_handler('unhandledrejection');

      var _init_micro_sentry = function() {
        if (_is_sentry_initialized()) {
          _host_sentry_present = true;
          _patch_all();
        } else {
          _normal_sentry_init();
        }
        _init_micro_complete = true;
        console.log("[micro] Initialized micro Sentry");
        _process_queued_errors();
      }
      document.addEventListener("DOMContentLoaded", () => {
        if (!_init_micro_complete) {
          _init_micro_sentry();
        }
      });
    }
    

  }
};
