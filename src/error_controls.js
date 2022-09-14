import {sticky_checkbox_get, sticky_checkbox_init} from './common.js';

//export async function init(mount_func, name) {

  /* appendChild() is not quite as synchronous as one may think: if we first
   * create controls and add them to DOM, then immediately throw an exception
   * - the controls won't get rendered. Likely appendChild() simply queues up
   * the operation (as an optimization) but exception results in the whole stack
   * frame with all the variables that the DOM worker processing the queue will
   * need to create elements.
   *
   * While normally using DOMContentLoaded listener is the solution, in this
   * example we want an error with a stacktrace originating in host.js, not
   * event listener */
//}
  

export function create({name, init_add_breadcrumb_callback, init_console_callback, 
  init_capture_message_callback, init_exception_callback, eventhandler_callback, settimeout_callback, 
  xhr_callback}) {

  let div = document.createElement("div");
  div.className="error_controls";
  div.innerHTML =
      `
      <span>
        <input type="checkbox" id="${name}_init_add_breadcrumb" name="${name}iab">
        <label for="${name}iab">
          S.addBreadcrumb()
        </label>
      </span>
      <span>
        <input type="checkbox" id="${name}_init_console" name="${name}ic">
        <label for="${name}ic">
          console.error()*
        </label>
      </span>
      <span>
        <input type="checkbox" id="${name}_init_capture_message" name="${name}icm">
        <label for="${name}icm">
          S.captureMessage()*
        </label>
      </span>
      <span>
        <input type="checkbox" id="${name}_init_exception" name="${name}ie">
        <label for="${name}ie">
          Exception*
        </label>
      </span>
      <button type="button" class="eventhandler">
        Event handler exception
      </button>
      <button type="button" class="settimeout">
        exception in setTimeout()
      </button>
      <button type="button" class="xhr">
        exception in XHR()
      </button>
      <div class="footnote">* - initial execution</div>
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
    req.addEventListener("load", xhr_callback);
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
