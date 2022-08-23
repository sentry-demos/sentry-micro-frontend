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
  proj_link.innerHTML = `[${module}] project (${proj_id})`;
  document.querySelector(after_elem_selector).after(proj_link);
} 

