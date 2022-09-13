import {default_host_init} from './init.js';

/* This is the recommended method.
 *
 * Tested with @sentry/browser v7.11.1, it might work with v6 but hasn't been tested
 *
 * This is intended for remote use-case (see README.md). If your micro-frontend is packaged as a
 * dependency (npm, yarn) and built, bundled and deployed into [host] application as part of [host]
 * team's build process, please checkout methods/lib-* and methods/3plib-*
 */

window.SENTRY_INIT_METHODS["3premote-1h2c-v7"] = {

  micro_sandbox_dont_load_script: true, // by sandbox only
  
  micro_internal_wrapper: null, // no wrapping inside [micro] is necessary
  
  init_host_sentry: default_host_init, // no changes needed in [host] code 


  /* This goes into [micro]'s code */
  // NOTE: this code will decide when and whether to load Sentry SDK dynamically
  // Do not load Sentry SDK anywhere else in your code (including any <scirpt> tags) 
  init_micro_sentry: function(
    tracing,      // sandbox only, remove in production code
    debug,        // sandbox only
    initialScope, // sandbox only

    // URL to dynamically load Sentry SDK bundle from
    sentry_sdk_src, 
    // -1 = no wait, 0 = wait for DOMContentLoaded, >0 = milliseconds past DOMContentLoaded
    max_wait_host_sentry_init = 2000, 
    // unique name of micro component, e.g. 'VideoPlayer' or 'ShoppingCart'
    component_name = 'micro', 
    // regex matching origin URL and filename of micro component
    stack_matcher = /http[s]?:\/\/(localhost:8000|(www\.)?sentry-micro-frontend\.net)\/micro.js/
    )  {
    
    var is_sentry_sdk_loaded = function() {
      return 'Sentry' in window; 
    }

    var is_sentry_initialized = function() {
      // Loading Sentry SDK will create __SENTRY__ but Hub + Client not created until init()
      return "__SENTRY__" in window && "hub" in window.__SENTRY__;
    }

    var process_queued_errors = function() {
      let errors = window.__SENTRY_MICRO__.error_queue;
      // this disables temp queueing hanlders, must be done before calling window.onerror() 
      delete window.__SENTRY_MICRO__.error_queue; 
      for (const [type, args] of errors) {
        let [micro, error] = match_and_extract(...args);
        if (micro) {

          delete error.__sentry_captured__; // see temp_queueing_patch()

          if (type === 'error') {
            window.onerror.apply(window, args);
          } else if (type === 'unhandledrejection') {
            window.onunhandledrejection.apply(window, args);
          } else { // type === 'trycatch'
            capture(micro, error);
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
    var match_and_extract = function(...args) {
      let msg, url, line, column, error;
      if (args[0] && typeof args[0] === 'object' && 'constructor' in args[0] && args[0].constructor.name === 'PromiseRejectionEvent') {
        error = args[0].reason
      } else if (args.length === 1) {
        error = args[0];
      } else {
        [msg, url, line, column, error] = args;
      }
      if (error) {
        let micro = match(error.stack);
        if (micro) {
          return [micro, error];
        }
      }
      return [null, error];
    };

    var match = function(stack) {
      let micros = window.__SENTRY_MICRO__.instances;
      for (const iname in micros) {
        if (stack.match(micros[iname].matcher)) {
          return micros[iname];
        }
      }
      return null;
    };

    var capture = function(micro, error) {
      // NOTE: we're skipping all this stuff:
      // https://github.com/getsentry/sentry-javascript/blob/249e64d02e/packages/browser/src/integrations/globalhandlers.ts#L82
      micro.client.captureException(error);
    }
    
    var patch_global_handler = function(eventType, patch_func) {
      let onEventType = `on${eventType}`;
      let old_handler = window[onEventType];
      let handler = function(...args) {
        patch_func(...args);
        if (old_handler) {
          // OK because error.__sentry_captured__ will stop host-sentry from reporting 
          return old_handler.apply(window, args);
        }
        return eventType === 'error' ? false : true;
      }
      window[onEventType] = handler;
    }

    // Temporary hanlder that queues errors, then becomes a pass-thru once no longer needed
    // Sentry.init() will chain this function similarly to how we chain old hanlder below. 
    // Once that happens we immediately patch it with a permanent filtering handler and
    // process all the queued errors
    var temp_queueing_patch = function(eventType) {
      return (...args) => {
        let eq = window.__SENTRY_MICRO__.error_queue;
        if (eq) {
          eq.push([eventType, args]);
          if (match_and_extract(...args)[1].__sentry_captured__) {
            // host-sentry is initialized and this is the first error captured. If this error 
            // is from micro then it has already leaked into into host-dsn/project. This won't
            // happen for subsequent erros.
            micro_init();
          }
        } 
      }
    }

    var filtering_patch = function(...args) {
        let [micro, error] = match_and_extract(...args);
        if (micro) {
          capture(micro, error);
        }
    }

    var wrap_callback = function(callback, patch_func) {
      return function(...callback_args) {
        try {
          callback(...callback_args); // apply?
        } catch (e) {
          patch_func(e);
          // captureException() sets error.__sentry_captured__ so won't be captured again by host-sentry
          throw e;
        }
      }
    }
    
    var patch_prop = function(object, prop_name, factory) {
      let original = object[prop_name];
      let patched = factory(original);
      object[prop_name] = patched;
    };

    // patches function like setTimeout(), etc by wrapping its callback (1st argument)
    var patch_set_callback_func = function(object, func_name, patch_func) {
      patch_prop(object, func_name, (original) => {
        return (...args) => { 
          let original_callback = args[0];
          args[0] = wrap_callback(original_callback, patch_func); 
          return original.apply(this, args);
        }
      });
    };

    var patch_xhr = function(patch_func) {
      if (!'XMLHttpRequest' in window) {
        return;
      }
      patch_prop(XMLHttpRequest.prototype, 'send', (original) => {
        return (...args) => { 
          var xhr = this;
          var callback_props = ['onload', 'onerror', 'onprogress', 'onreadystatechange'];
          callback_props.forEach(prop => {
            if (callback_prop in xhr && typeof xhr[callback_prop] === 'function') {
              patch_prop(xhr, callback_prop, wrap_callback(xhr[callback_prop], patch_func));
            }
          });
          return original.apply(this, args);
        }
      });
    }

    var init_micro_registry = function () {
      if (window.__SENTRY_MICRO__ === undefined) {
        window.__SENTRY_MICRO__ = {instances: {}};
      }
      window.__SENTRY_MICRO__.instances[component_name] = { 
        matcher: stack_matcher
      };
    }

    var init_micro_client = function() {
      window.__SENTRY_MICRO__.instances[component_name].client = new Sentry.BrowserClient({
        dsn: MICRO_DSN,
        release: MICRO_RELEASE,
        debug: !(debug === undefined || debug === false), /* remove this (sandbox) */
        transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport)
      });
    }

    var is_micro_client_initialized = function() {
      return window.__SENTRY_MICRO__.instances[component_name].client !== undefined;
    }

    var normal_filtering_sentry_init = function(init_function) {
      init_function({
          dsn: MICRO_DSN,
          release: MICRO_RELEASE,
          debug: !(debug === undefined || debug === false), 
          integrations: tracing === undefined || tracing === false ? [] : [new Sentry.BrowserTracing() ],
          tracesSampleRate: 1.0,
          initialScope: initialScope,
          beforeSend: (event, hint) => {
            let stack = hint.originalException.stack || hint.syntheticException.stack;
            let micro = match(stack);
            if (micro) {
              event.release = micro.client._options.release;
              micro.client.captureEvent(event);
              return null;
            }
            return event;
          }
      });
    }

    var patch_temp_queueing_handlers = function() {
      window.__SENTRY_MICRO__.error_queue = [];
      patch_global_handler('error', temp_queueing_patch('error'));
      patch_global_handler('unhandledrejection', temp_queueing_patch('unhandledrejection'));
      patch_set_callback_func(window, 'setTimeout', temp_queueing_patch('trycatch'));
      patch_set_callback_func(window, 'setInterval', temp_queueing_patch('trycatch'));
      patch_set_callback_func(window, 'requestAnimationFrame', temp_queueing_patch('trycatch'));
      patch_xhr(temp_queueing_patch('trycatch'));
    }

    var patch = function() {
      // these correspond to GlobalHandlers and TryCatch integrations
      patch_global_handler('error', filtering_patch);
      patch_global_handler('unhandledrejection', filtering_patch);
      patch_set_callback_func(window, 'setTimeout', filtering_patch);
      patch_set_callback_func(window, 'setInterval', filtering_patch);
      patch_set_callback_func(window, 'requestAnimationFrame', filtering_patch);
      patch_xhr(filtering_patch);

    }

    var has_DOMContentLoaded_already_fired = function() {
      return document.readyState === "complete" ||
          (document.readyState !== "loading" && !document.documentElement.doScroll);
    }

    var after_max_wait = function(callback) {
      var loaded = has_DOMContentLoaded_already_fired();
      var wait = max_wait_host_sentry_init;

      if (wait == -1 || loaded && wait == 0) {
        callback();
      } else if (loaded) {
          window.setTimeout(callback, wait);
      } else {
        document.addEventListener("DOMContentLoaded", wait == 0 ? callback : () => {
          if (is_sentry_initialized()) {
            callback();
          } else {
            window.setTimeout(callback, wait);
          }
        });
      }
    }
    
    var load_sentry_sdk_if_needed_then = function(callback) {
      if (is_sentry_sdk_loaded()) {
        callback();
      } else {
        dynamic_load_sentry_sdk(callback);
      }
    }

    var dynamic_load_sentry_sdk = function(callback) {
      let script = document.createElement('script');
      script.onload = callback;
      script.src = sentry_sdk_src;
      document.head.appendChild(script);
    }

    var patch_immediately_after_sentry_init = function(patch_func) {
      var orig_sentry_init = Sentry.init;
      patch_prop(Sentry, 'init', (orig_init) => {
        return (...args) => {
          orig_sentry_init.apply(window, args); // host-sentry init()
          patch_func();
        }
      });
      return orig_sentry_init;
    }
    
    var micro_init = function() {
      if (is_micro_client_initialized()) {
        return;
      }
      init_micro_client();
      patch(); 
      if (window.__SENTRY_MICRO__.error_queue) {
        process_queued_errors();
      }
    }
    
    /* --->  Entry point <--- */

    init_micro_registry();

    if (is_sentry_initialized()) {
      micro_init();
    } else {
      patch_temp_queueing_handlers();

      if (is_sentry_sdk_loaded()) { 
        var orig_sentry_init = patch_immediately_after_sentry_init(() => {
          micro_init();
        });
      }
      
      after_max_wait(() => { 
        load_sentry_sdk_if_needed_then(() => {
          if (is_sentry_initialized()) {
            micro_init(); // if not already, see temp_queueing_patch() and patch_immediately...
          } else {
            normal_filtering_sentry_init(orig_sentry_init ? orig_sentry_init : Sentry.init);
            process_queued_errors();
            // TODO what if host wakes up from coma and calls Sentry.init() after this? should 
            // we stub Sentry.init() with something that will report a meaningful message to 
            // micro-dsn, host-dsn or both?
          }
        });
      });
    }
  }
};
