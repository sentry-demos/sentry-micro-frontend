import {dynamic_load_sentry} from './dynamic_load_sentry.js'
import {sticky_checkbox_get, sticky_select_get} from './src/common.js';
import * as ErrorControls from './src/error_controls.js' ;
  
let module = "micro";

export async function micro_init(...args){

  if (sticky_checkbox_get(`${module}_sentry_enabled`)) {
    /* --> [host] Sentry initialized here <-- */
    const internal_wrapper = await dynamic_load_sentry(module);

    if (internal_wrapper) {
      return internal_wrapper(() => {_micro_init(...args)});
    } else {
      return _micro_init(...args);
    }

  } else {
    console.log("[micro] Sentry not loaded (see UI checkbox).");
  }
}
  
function _micro_init(mount_func) {

    /* Initialize module and mount its UI elements at specified location in the DOM */

    let module_root = document.createElement("div");
    module_root.className="module_root"
    module_root.id = `${module}`;
    module_root.innerHTML = `<div class="module_title">${module}</div>`;

    let moduleU = module.toUpperCase();
    let [error_controls, eval_errors] = ErrorControls.create({name: module,
      init_add_breadcrumb_callback: () => {
        /* TODO: Sentry or SentryMicro ? */
        Sentry.addBreadcrumb({message: `Breadcrumb message [${moduleU}]`});},
      init_console_callback: () => {
        console.error(`logged error to console [${moduleU}]`);},
      init_capture_message_callback: () => {
        Sentry.captureMessage(`Message captured with Sentry.captureMessage() [${moduleU}]`);},
      init_exception_callback: () => {
        throw new Error(`Uncaught exception in [${moduleU}]`);},
      eventhandler_callback: () => {
        throw new Error(`Uncaught exception in event handler added by [${moduleU}]`);},
      settimeout_callback: () => {
        throw new Error(`Uncaught exception in setTimeout callback [${moduleU}]`);}
    });

    module_root.appendChild(error_controls);

    mount_func(module_root);

    eval_errors();
}

