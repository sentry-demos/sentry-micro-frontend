import {default_host_init} from './init.js';

/* All the code included in this repository is intended as example only and should NOT be
 * adopted for use in production software without first undergoing full review and rigorous 
 * testing. This code is provided on an "AS-IS" basis without warranty of any kind, either 
 * express or implied, including without limitation any implied warranties of condition, 
 * uninterrupted use, merchantability, fitness for a particular purpose, or non-infringement.
 * The details of your application or component, architecture of the host-application, and 
 * your target browser support, among many other things, may require you to modify this code.
 * Issues regarding these code examples should be submitted through GitHub.
 *
 * This is intended for 'remote' use-case (see README.md). If your component is packaged as a
 * dependency (npm, yarn) and built, bundled and deployed as part of host-application's build
 * process, then you should use other methods prefixed with 'lib-'
 */

window.SENTRY_INIT_METHODS["flex-micro"] = {

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
    trace_propagation_targets, // sandbox only

    // URL to dynamically load Sentry SDK bundle from
    sentry_sdk_src, 
    // -1 = no wait, 0 = wait for DOMContentLoaded, >0 = milliseconds past DOMContentLoaded
    max_wait_host_sentry_init = 2000, 
    // unique name of micro component, e.g. 'VideoPlayer' or 'ShoppingCart'
    component_name = 'micro', 
    // regex matching origin URL and filename of micro component
    stack_matcher = /http[s]?:\/\/(localhost:8000|(www\.)?sentry-micro-frontend\.net)(\/.*)?\/micro(\.min)?\.js/,
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
        try {
          delete error.__sentry_captured__; // see temp_queueing_patch()
        } catch (x) {}

        if (type === 'error') {
          window.onerror.apply(window, args);
        } else if (type === 'unhandledrejection') {
          window.onunhandledrejection.apply(window, args);
        } else { // type === 'trycatch'
          throw error;
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
          let [micro, error] = match_and_extract(...args);
          let captured = undefined;
          try {
            captured = error.__sentry_captured__;
          } catch (x) {}
          if (captured) {
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
          callback.apply(this, callback_args);
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
      patch_prop(object, func_name, function(original) {
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
      patch_prop(XMLHttpRequest.prototype, 'send', function(original) {
        return function(...args) { 
          var xhr = this;
          var callback_props = ['onload', 'onerror', 'onprogress', 'onreadystatechange'];
          callback_props.forEach(prop  => {
            if (prop in xhr && typeof xhr[prop] === 'function') {
              patch_prop(xhr, prop, wrap_callback(xhr[prop], patch_func));
            }
          });
          return original.apply(xhr, args);
        }
      });
    }

    const DEFAULT_EVENT_TARGET = [
      'EventTarget',
      'Window',
      'Node',
      'ApplicationCache',
      'AudioTrackList',
      'ChannelMergerNode',
      'CryptoOperation',
      'EventSource',
      'FileReader',
      'HTMLUnknownElement',
      'IDBDatabase',
      'IDBRequest',
      'IDBTransaction',
      'KeyOperation',
      'MediaController',
      'MessagePort',
      'ModalWindow',
      'Notification',
      'SVGElementInstance',
      'Screen',
      'TextTrack',
      'TextTrackCue',
      'TextTrackList',
      'WebSocket',
      'WebSocketWorker',
      'Worker',
      'XMLHttpRequest',
      'XMLHttpRequestEventTarget',
      'XMLHttpRequestUpload',
    ];

    var add_nonenum_prop = function(obj, prop, value) {
      obj.prototype = obj.prototype || {};
      Object.defineProperty(obj, prop, {value: value, writable: true, configurable: true});
    }

    var patch_event_target = function(target, patch_func) {
      var proto = window[target] && window[target].prototype;
      if (!proto || !proto.hasOwnProperty || !proto.hasOwnProperty('addEventListener')) {
        return;
      }

      patch_prop(proto, 'addEventListener', function (original_add) {
        return function (eventName, fn, options) {
          // fn can be either function or EventListenerObject
          try {
            if (typeof fn.handleEvent === 'function') {
              fn.handleEvent = wrap_callback(fn.handleEvent, patch_func);
            }
          } catch (err) {
            // can sometimes get 'Permission denied to access property "handle Event'
          }
          var wrapped_fn;
          if (typeof fn === 'function') {
            wrapped_fn = wrap_callback(fn, patch_func);
            // So that we can remove it when application calls removeEventListener with original
            // as argument!
            try {
              add_nonenum_prop(fn, '__sentry_micro_wrapped__', wrapped_fn);
            } catch (x) {}
          }  
          return original_add.apply(this, [eventName, wrapped_fn, options]);
        };
      });

      // application code only knows about original handler, not the wrapped one
      // see browser/src/integrations/trycatch.ts
      patch_prop(proto, 'removeEventListener', function (original_remove) {
        return function (eventName, fn, options) {
          try {
            const original_handler = fn;
            const wrapped_handler = original_handler && original_handler.__sentry_micro_wrapped__;
            if (wrapped_handler) {
              original_remove.call(this, eventName, wrapped_handler, options);
            }
          } catch (e) {
            // ignore, accessing __sentry_wrapped__ will throw in some Selenium environments
          }
          const never_wrapped_handler = fn;
          return original_remove.call(this, eventName, never_wrapped_handler, options);
        };
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
        transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport),
        integrations: []
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
          integrations: tracing === undefined || tracing === false ? [] : [new Sentry.BrowserTracing({
            tracePropagationTargets: trace_propagation_targets 
          }) ],
          tracesSampleRate: 1.0,
          initialScope: initialScope,
          beforeSend: (event, hint) => {
            let stack = hint.originalException.stack || hint.syntheticException.stack;
            let micro = match(stack);
            if (micro) {
              event.release = micro.client.getOptions().release;
              micro.client.captureEvent(event);
            }
            return null; // host error, don't care
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
      DEFAULT_EVENT_TARGET.forEach((t) => patch_event_target(t, temp_queueing_patch('trycatch')));
    }

    var patch = function() {
      // these correspond to GlobalHandlers and TryCatch integrations
      patch_global_handler('error', filtering_patch);
      patch_global_handler('unhandledrejection', filtering_patch);
      patch_set_callback_func(window, 'setTimeout', filtering_patch);
      patch_set_callback_func(window, 'setInterval', filtering_patch);
      patch_set_callback_func(window, 'requestAnimationFrame', filtering_patch);
      patch_xhr(filtering_patch);
      DEFAULT_EVENT_TARGET.forEach((t) => patch_event_target(t, filtering_patch));
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
      patch_prop(Sentry, 'init', function(orig_init) {
        return (...args) => {
          orig_sentry_init.apply(this, args); // host-sentry init()
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
            init_micro_client();
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
