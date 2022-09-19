/* NOTE: this will result [micro] dynamically loading sentry bundle first
 * In the real world 
 *    1. [h] and [m] could load different versions of Sentry SDK 
 *    2. Depending on initialization order global event handlers registered
 *       by each [h] and [m] may execute in any order
 */  
import {dynamic_load_sentry, fool_isNativeFetch} from './dynamic_load_sentry.js'
import {sticky_select_init, sticky_checkbox_init, add_project_link, sticky_checkbox_get} from './src/common.js';
import * as ErrorControls from './src/error_controls.js' ;
import {micro_init} from './micro.js';

sticky_select_init("method", "simple-lib");
sticky_select_init("sentry_sdk_version", "7.11.1");
sticky_checkbox_init("host_sentry_enabled",  true);
sticky_checkbox_init("micro_sentry_enabled",  true);
sticky_checkbox_init("sentry_sdk_min_js",  false);
sticky_checkbox_init("host_sentry_tracing",   false);
sticky_checkbox_init("micro_sentry_tracing",  false);
sticky_checkbox_init("host_sentry_debug",     false);
sticky_checkbox_init("micro_sentry_debug",    false);
if (MICRO_PROJECT_URL) {add_project_link(MICRO_PROJECT_URL, "micro", "label[for=msd]");};
if (HOST_PROJECT_URL) {add_project_link(HOST_PROJECT_URL, "host", "label[for=msd]");};

const nativeFetch = window.fetch;
window.fetch = function(...args) {
  let body = args[1].body;
  if (!body.match(/"type":"session"/)) {
    let error_msg = body.match(/"type":"Error","value":"([^"]+)/)[1];
    let truncated_url = args[0].replace(/\?.*/,'...');
    console.log(`Sending error "${error_msg}" to ${truncated_url}`);
  }
  return nativeFetch.apply(window, args);
};
fool_isNativeFetch();

  
let module = "host";

/* --> [host] Sentry initialized here <-- */
if (sticky_checkbox_get("host_sentry_enabled")) {
  await dynamic_load_sentry(module);
  fool_isNativeFetch();
} else {
  console.log(`[${module}] Sentry not loaded (see UI checkbox).`);
}

/* --> [host] application initialized here <-- */
if (
    document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  host_init();
} else {
  console.log("DOMContentLoaded");
  document.addEventListener("DOMContentLoaded", host_init);
};

function host_init() {

  let module = "host";
  let module_root = document.querySelector(`.module_root#${module}`);

  let old_html = module_root.innerHTML;
  module_root.innerHTML = 
    `<div class="module_title">${module}</div>
    ` + old_html;

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
      throw new Error(`Uncaught exception in setTimeout callback [${moduleU}]`);},
    xhr_callback: () => {
      throw new Error(`Uncaught exception in XMLHttpRequest's 'load' callback [${moduleU}]`);}
  });

  let title = module_root.querySelector(".module_title");
  title.after(error_controls);

  /* Initialize and mount Micro */
  let mt_point = document.querySelector('#micro_mount_point');
  micro_init((e) => {mt_point.appendChild(e)});
  
  eval_errors();
};

