import './init.js';
  
/* THIS METHOD IS EXPERIMENTAL 
 *
 * Use at your own risk. Not tested thoroughly. 
 *
 * Included to serve as a starting point and inspiration.
 */

window.SENTRY_INIT_METHODS["lib-1h2c-beacon-v6"] = {

  micro_internal_wrapper: null, 

  init_host_sentry:  function(tracing, debug, initialScope) {
    
    // browser support: Chrome 104, FF 104 
    var _stack_normalize = function(stack) {
      // first, remove leading whitespace, "at " and "async"
      return stack.replace(/(?<=(\n|^))\s*(at )?(async(\s|[*]))?(?=[^\s@(]+)/g, '')
             .replace(/:[0-9]+:[0-9]+\)?(?=\n|$)/g,'') // remove ":line:col"
             .replace(/(?<=[^\s@(/:]+)( \(|@)/," "); // normalize function-file separator 
    }
    
    var _find_micro_entry_point = function(stack_beacon_host, stack_beacon_micro) {
      let sh = _stack_normalize(stack_beacon_host).split("\n").reverse();  
      let sm = _stack_normalize(stack_beacon_micro).split("\n").reverse();  
      // Find the first differing stack frame
      // NOTE: Chrome will discard all preceding frames when returning from 'await' statement
      for (let i = 0; i < sm.length; i++) { 
        if (i >= sh.length || sm[i] != sh[i]) {
          let func_file = sm[i].split(/ \(|@/);
          if (func_file.length == 2) {
            return func_file;
          }
        }
      }
      return [null, null];
    }

    var get_micro_instances = function() {
        let wsm = window.__SENTRY_MICRO__;
        if (wsm === undefined || wsm.instances === undefined) {
          return [];
        }
        // We don't know when new microFE's are loaded so better check for new ones each time 
        for (const iname in wsm.instances) {
          let inst = wsm.instances[iname]; 
          if (!'beacon' in inst) { // means it hasn't been initialized yet
            continue;
          }
          const [func, file] = _find_micro_entry_point(wsm.host_beacon.stack, inst.beacon.stack);
          inst.matcher = file ? new RegExp(file) : /a^/; // never matches 
          delete inst.beacon;
        }
        return wsm.instances;
    }

    /* TODO */
    wsm.host_beacon = new Error();

    
    Sentry.init({
      dsn: HOST_DSN,
      release: HOST_RELEASE,
      debug: debug, /* remove this (sandbox) */
      integrations: tracing ? [new Sentry.BrowserTracing()] : [], /* remove condition */
      tracesSampleRate: 1.0,
      initialScope: initialScope, /* remove */

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

  init_micro_sentry: function(tracing, debug, initialScope) {

    if (window.__SENTRY_MICRO__ === undefined) {
      window.__SENTRY_MICRO__ = {instances: {}};
    }

    window.__SENTRY_MICRO__.instances["micro"] = {
      beacon: new Error(), // used to find micro's filename
      client: new Sentry.BrowserClient({
        dsn: MICRO_DSN,
        release: MICRO_RELEASE,
        debug: debug, /* remove this (sandbox) */
        transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport)
      })
    }
  }
};

