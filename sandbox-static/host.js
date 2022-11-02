/* NOTE: this will result [host] dynamically loading sentry bundle first
 * In the real world 
 *    1. [h] and [m] could load different versions of Sentry SDK 
 *    2. Depending on initialization order global event handlers registered
 *       by each [h] and [m] may execute in any order
 */  
import * as Com from '../common.js'
import {micro_init} from './micro.js';

let module = "host";
  

/* --> [host] Sentry initialized here <-- */
if (Com.sticky_checkbox_get("host_sentry_enabled")) {
  await Com.dynamic_load_sentry(module);
} 

/* --> [host] application initialized here <-- */
Com.onDomContentLoaded(
  function() {
    let module_root = document.querySelector(`.module_root#${module}`);

    let old_html = module_root.innerHTML;
    module_root.innerHTML = 
      `<div class="module_header">
        <span class="module_title">${module}</span> 
        <span class="component_sentry_controls">
          <input type="checkbox" id="host_sentry_enabled" name="lhs"><label for="lhs">Sentry</label>
          <input type="checkbox" id="host_sentry_tracing" name="hst"><label for="hst">tracing</label>
          <input type="checkbox" id="host_sentry_debug" name="hsd"><label for="hsd">debug</label>
        </span>
      </div>` + old_html;
    Com.sticky_checkbox_init("host_sentry_enabled",  true);
    Com.sticky_checkbox_init("host_sentry_tracing",   false);
    Com.sticky_checkbox_init("host_sentry_debug",     false);
    if (HOST_PROJECT_URL) {Com.add_project_link(HOST_PROJECT_URL, "host", "label[for=hsd]");};

    let moduleU = module.toUpperCase();
    let [error_controls, eval_errors] = Com.error_palette_create({name: module,
      init_add_breadcrumb_callback: () => {
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
        throw new Error(`Uncaught exception in XMLHttpRequest's 'load' callback [${moduleU}]`);}
    });

    let title = module_root.querySelector(".module_header");
    title.after(error_controls);

    /* Initialize and mount Micro */
    let mt_point = document.querySelector('#micro_mount_point');
    micro_init((e) => {mt_point.appendChild(e)});
    
    eval_errors();
  }
);

