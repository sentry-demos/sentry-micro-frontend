function get_script_src(version, min_js) {
  return `https://browser.sentry-cdn.com/${version}/bundle.tracing${min_js?".min":""}.js`;
}

if (window.SENTRY_INIT_METHODS === undefined) {
  window.SENTRY_INIT_METHODS = {};
};
