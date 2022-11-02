export function onDomContentLoaded(callback) {
  if (
      document.readyState === "complete" ||
      (document.readyState !== "loading" && !document.documentElement.doScroll)
  ) {
    callback();
  } else {
    document.addEventListener("DOMContentLoaded", callback());
  };
}

export function sticky_checkbox_init(id, initial_value, root = document) {
  let cbox = root.querySelector(`#${id}`);
  if (sessionStorage.getItem(id) == null) { /* null or undefined */
    cbox.checked = initial_value;
    sessionStorage.setItem(id, initial_value);
  } else {
    cbox.checked = sessionStorage.getItem(id) === "true";
  };
  cbox.addEventListener("change", () => {
    sessionStorage.setItem(id, cbox.checked);
    window.location.reload();
  });
};

export function sticky_checkbox_get(id) {
  return sessionStorage.getItem(id) === "true";
};

export function sticky_select_init(id, initial_value, root = document) {
  let sel = root.querySelector(`#${id}`);
  let options = Array.from(sel.options).map((o) => o.value);
  let saved_value = sessionStorage.getItem(id);
  if (saved_value == null || !options.includes(saved_value)) {
    sel.value = initial_value;
    sessionStorage.setItem(id, sel.value);
  } else {
    sel.value = sessionStorage.getItem(id);
  };
  sel.addEventListener("change", () => {
    sessionStorage.setItem(id, sel.value);
    window.location.reload();
  });
};

export function sticky_select_get(id) {
  return sessionStorage.getItem(id);
};

export function add_project_link(url, module, after_elem_selector) {
  let proj_link = document.createElement("a");
  proj_link.className = "sentry_project";
  proj_link.target = "_blank";
  proj_link.href = url;
  let proj_id = url.match(/[?&]project=([0-9]+)/)[1] 
  proj_link.innerHTML = `project ${proj_id}`;
  document.querySelector(after_elem_selector).after(proj_link);
} 

export async function dynamic_load_script(src, module=false) {
    let script = document.createElement('script');
    if (module) {
      script.type = "module";
    }
    let script_loaded = new Promise((r) => {
      script.onload = r;
    });
    script.src = src;
    document.head.appendChild(script);
    await script_loaded;
}

export async function dynamic_load_methods() {
  // we use this instead of <script> tags because those would need to be in 
  // inside iframe, meaning would have to be duplicated across all sandboxes since
  // we don't use server-side includes. Loading dynamically allows code re-use through
  // reusing common.js
  await dynamic_load_script("../methods/init.js", true);
  await dynamic_load_script("../methods/naive.js", true);
  await dynamic_load_script("../methods/simple-lib.js", true);
  await dynamic_load_script("../methods/simple-remote.js", true);
  await dynamic_load_script("../methods/flex-micro.js", true);
}

var _patched_fetch = false;

export async function dynamic_load_sentry(module) {

  if (!_patched_fetch) {
    patch_fetch_log_sent_errors(); // must be done in iframe since it has own window.fetch
  }

  let method = sticky_select_get("method");
  if (window.SENTRY_INIT_METHODS === undefined) {
    await dynamic_load_methods();
  }
  let method_impl = window.SENTRY_INIT_METHODS[method];
  let sdk_version_and_bundle = sticky_select_get("sentry_sdk_version");

  let sentry_sdk_src = `https://browser.sentry-cdn.com/${sdk_version_and_bundle}`; 

  if (!(module === 'micro' && 'micro_sandbox_dont_load_script' in method_impl)) {
    await dynamic_load_script(sentry_sdk_src);
  }

  /* --> [micro] Sentry initialized here <-- */
  method_impl[`init_${module}_sentry`](
    sticky_checkbox_get(`${module}_sentry_tracing`),
    sticky_checkbox_get(`${module}_sentry_debug`),
    {tags: {mv: `${method}@${sdk_version_and_bundle}`}},
    sentry_sdk_src
  );
  
  fool_isNativeFetch(); // need to do this again

  return method_impl.micro_internal_wrapper;
}


export function patch_fetch_log_sent_errors() {
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
  _patched_fetch = true;
}

/* When Sentry client is created it will check if window.fetch is the original native implementation
   and if not will get not use it and instead get a native impl. by doing a crazy trick with an iframe.
   If we want to log requests sent to Sentry in this sandbox we have to both spoof the fetch() and fool 
   Sentry SDK into using the spoofed version.
   */
export function fool_isNativeFetch() {
  window.fetch.toString = () => 'function fetch() { [native code] }'; // fool Sentry's isNativeFetch()
}

export function error_palette_create({name, init_add_breadcrumb_callback, init_console_callback, 
  init_capture_message_callback, init_exception_callback, eventhandler_callback, settimeout_callback, 
  xhr_callback}) {

  let div = document.createElement("div");
  div.className="error_controls";
  div.innerHTML =
      `
      <span>
        <input type="checkbox" id="${name}_init_add_breadcrumb" name="${name}iab">
        <label for="${name}iab">
          addBreadcrumb()
        </label>
      </span>
      <span>
        <input type="checkbox" id="${name}_init_console" name="${name}ic">
        <label for="${name}ic">
          console.error()
        </label>
      </span>
      <span>
        <input type="checkbox" id="${name}_init_capture_message" name="${name}icm">
        <label for="${name}icm">
          captureMessage()
        </label>
      </span>
      <span>
        <input type="checkbox" id="${name}_init_exception" name="${name}ie">
        <label for="${name}ie">
          throw 
        </label>
      </span>
      <button type="button" class="eventhandler">
        Event handler
      </button>
      <button type="button" class="settimeout">
        setTimeout()
      </button>
      <button type="button" class="xhr">
        XHR.onload()
      </button>
      `;
  
  let b_eventhandler    = div.querySelector('.eventhandler');
  let b_settimeout      = div.querySelector('.settimeout');
  let b_xhr             = div.querySelector('.xhr');
  
  sticky_checkbox_init(`${name}_init_add_breadcrumb`, false, div);
  sticky_checkbox_init(`${name}_init_console`, false, div);
  sticky_checkbox_init(`${name}_init_capture_message`, false, div);
  sticky_checkbox_init(`${name}_init_exception`, false, div);
  
  b_eventhandler.addEventListener("click", () => {
    eventhandler_callback();
  });
  b_settimeout.addEventListener("click", () => {
    window.setTimeout(settimeout_callback, 1000);
  });
  b_xhr.addEventListener("click", () => {
    const req = new XMLHttpRequest();
    req.onload = xhr_callback; 
    req.open("GET", "/index.html");
    req.send();
  });

  let eval_errors = function() {
    if (sticky_checkbox_get(`${name}_init_add_breadcrumb`)) {
      init_add_breadcrumb_callback();
    }
    if (sticky_checkbox_get(`${name}_init_console`)) {
      init_console_callback();
    }
    if (sticky_checkbox_get(`${name}_init_capture_message`)) {
      init_capture_message_callback();
    }
    if (sticky_checkbox_get(`${name}_init_exception`)) {
      init_exception_callback();
    }
  };

  return [div, eval_errors];
};
