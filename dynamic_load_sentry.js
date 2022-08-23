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

function _get_script_src(version, min_js) {
  return `https://browser.sentry-cdn.com/${version}/bundle.tracing${min_js?".min":""}.js`;
}

