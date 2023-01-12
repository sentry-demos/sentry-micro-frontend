import * as Com from '../common.js'
  
let module = "micro";

export async function micro_init(...args){
  if (Com.sticky_checkbox_get(`${module}_sentry_enabled`)) {
    /* --> [host] Sentry initialized here <-- */
    const internal_wrapper = await Com.dynamic_load_sentry(module);
  } else {
    console.log("[micro] Sentry not loaded (see UI checkbox).");
  }

  if (typeof internal_wrapper !== 'undefined') {
    return internal_wrapper(() => {_micro_init(...args)});
  } else {
    return _micro_init(...args);
  }
}
  
function _micro_init(mount_func) {

    /* Initialize module and mount its UI elements at specified location in the DOM */

    let module_root = document.createElement("div");
    module_root.className="module_root"
    module_root.id = `${module}`;
    module_root.innerHTML = `
      <div class="module_header">
        <span class="module_title">${module}</span> 
        <span class="component_sentry_controls">
          <input type="checkbox" id="micro_sentry_enabled" name="lms"><label for="lms">Sentry</label>
          <input type="checkbox" id="micro_sentry_tracing" name="mst"><label for="mst">tracing</label>
          <input type="checkbox" id="micro_sentry_debug" name="msd"><label for="msd">debug</label>
        </span>
      </div>`;

    let moduleU = module.toUpperCase();
    let [error_controls, eval_errors] = Com.error_palette_create({name: module,
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
        throw new Error(`Uncaught exception in setTimeout callback [${moduleU}]`);},
      xhr_callback: () => {
        throw new Error(`Uncaught exception in XMLHttpRequest's 'load' callback [${moduleU}]`);},
      fetchbe_callback: () => {
        throw new Error(`Uncaught exception in fetch(BE).catch() [${moduleU}]`);},
    });

    module_root.appendChild(error_controls);

    mount_func(module_root);

    Com.sticky_checkbox_init("micro_sentry_enabled",  true);
    Com.sticky_checkbox_init("micro_sentry_tracing",  true);
    Com.sticky_checkbox_init("micro_sentry_debug",    false);
    if (MICRO_PROJECT_URL) {Com.add_project_link(MICRO_PROJECT_URL, "micro", "label[for=msd]");};

    eval_errors();
}

