import {sticky_checkbox_get, sticky_select_get} from './src/common.js';

export async function dynamic_load_sentry(module) {

  let method = sticky_select_get("method");
  let sdk_version = sticky_select_get("sentry_sdk_version");

  let script = document.createElement('script');
  let script_loaded = new Promise((r) => {
    script.onload = r;
  });
  script.src=_get_script_src(sdk_version, sticky_checkbox_get("sentry_sdk_min_js"));
  document.head.appendChild(script);

  await script_loaded;

  /* --> [micro] Sentry initialized here <-- */
  let method_impl = window.SENTRY_INIT_METHODS[method];
  method_impl[`init_${module}_sentry`](
    sticky_checkbox_get(`${module}_sentry_tracing`),
    sticky_checkbox_get(`${module}_sentry_debug`),
    {tags: {mv: `${method}@${sdk_version}`}}
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
  return `https://browser.sentry-cdn.com/${version}/bundle.tracing${min_js?".min":""}.js`;
}

