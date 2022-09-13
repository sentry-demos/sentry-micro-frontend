import {sticky_checkbox_get, sticky_select_get, dynamic_load_script} from './src/common.js';

export async function dynamic_load_sentry(module) {

  let method = sticky_select_get("method");
  let method_impl = window.SENTRY_INIT_METHODS[method];
  let sdk_version = sticky_select_get("sentry_sdk_version");

  let sentry_sdk_src = _get_script_src(sdk_version, sticky_checkbox_get("sentry_sdk_min_js")); 

  if (!(module === 'micro' && 'micro_sandbox_dont_load_script' in method_impl)) {
    await dynamic_load_script(sentry_sdk_src);
  }

  /* --> [micro] Sentry initialized here <-- */
  method_impl[`init_${module}_sentry`](
    sticky_checkbox_get(`${module}_sentry_tracing`),
    sticky_checkbox_get(`${module}_sentry_debug`),
    {tags: {mv: `${method}@${sdk_version}`}},
    sentry_sdk_src
  );

  return method_impl.micro_internal_wrapper;
}

/* When Sentry client is created it will check if window.fetch is the original native implementation
   and if not will get not use it and instead get a native impl. by doing a crazy trick with an iframe.
   If we want to log requests sent to Sentry in this sandbox we have to both spoof the fetch() and fool 
   Sentry SDK into using the spoofed version.
   */
export function fool_isNativeFetch() {
  window.fetch.toString = () => 'function fetch() { [native code] }'; // fool Sentry's isNativeFetch()
}

function _get_script_src(version, min_js) {
  let tracing = true;
  if (version == "5.5.0") {
    tracing = false; // tracing bundle not available for 5.5.0
  }
  return `https://browser.sentry-cdn.com/${version}/bundle${tracing?".tracing":""}${min_js?".min":""}.js`;
}

