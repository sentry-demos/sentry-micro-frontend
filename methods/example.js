import './init.js';
  
window.SENTRY_INIT_METHODS["your-method-name"] = {

  init_host_sentry:  function(tracing, debug, initialScope) {
    /* Your code here, e.g.:

        Sentry.init(...) 
    */
  },

  init_micro_sentry: function(tracing, debug, initialScope) {
    /* Your code here, e.g.: 

        // do nothing
    */
  },

  /* Whether Micro-frontend should dynamically load Sentry SDK bundle */
  micro_sandbox_dont_load_script: false,
  
  /* 
    Wrapper code for micro-frontend's entry point.
    If no wrapping necessary, omit or set to null 
  */
  micro_internal_wrapper: function(micro_init_callback) { 
    /* Your code here, e.g.:

        Sentry.wrap(micro_init_callback);

        if no wrapper needed set
    */
  },
};
