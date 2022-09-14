# Summary
What is this repo?
* A **sandbox** for testing Sentry integration in [Micro-frontent (MFE)](https://micro-frontends.org/) architecture. (including both true, i.e. remote, MFEs and traditional build-time libraries)
	* See [Sandbox how-to](#sandbox)
* A **collection of code snippets** (["methods"](https://github.com/realkosty/sentry-micro-frontend/tree/main/methods)) 
* **This documentation**. Keep on reading.

# Problem Overview
Micro-frontend is pattern in web application design where a single user-facing application is composed of 2 or more separate frontend components each owned (and in the case of true, remote, MFEs - also deployed and operated) by a separate team. In this architecture the goal is to allow each component-owner team to build with maximum independence. Naturally the developers want the errors from different components **go into their own separate Sentry projects/DSNs**. Unfortunately, the naive approach of importing `@sentry/browser` and calling `Sentry.init()` in every component does not work.

We use the term Micro-frontend to describe 2 distinct architectures:
* **True (remote) micro-frontends**: components are built, deployed and served separately. Often associated with Webpack's module federation.[^1]
*  **Library** (lib) components are package dependencies included (`npm, yarn`) during `[host]` app's build process. They are deployed together with the host app and served from the same origin and sometimes even the same bundle file. 

We further distinguish organizationally:
* **Same company** (remote, lib) `host` and `micro` are owned by different teams within the same company.
* **3rd Party** (3premote, 3plib) Typically multiple `host` apps owned by separate 3rd party companies who are `micro`'s customers.

Terminology: we refer to top-level web application that consumes individual (either **"remote"** or **"lib"**) components developed by different teams as `host` and non-host components themselves as `micro`'s. 
* `host` = host application (no relation to network host), that ties all components (`micro`s) together into a single user-facing web application.
* `micro` = one of the components (either "remote" or "lib") included in the `host` app. Usually a widget, plugin or library. A `micro` may be used in different `host`s.

There is no (fundamental) difference from the browser runtime perspective. However, when it comes to the dev process, the two couldn't be further apart:
| | remote | lib | 3premote | 3plib |
| --- | --- | --- | --- | --- | 
| Component-level ownership | yes |  yes | yes | yes |
| `micro` team controls their code's deployment to prod | yes | no | yes | no |
| `micro` team controls their code's minification and URL paths | yes | no | yes | no |
| Code changes in the `host` are undesirable | no | no | yes | yes |

This last difference is of huge imporance when integrating Sentry. It turns out that **library** architecture presents some unique. 

[^1]: Since this is a new and evolving space we try, whenever possible, to provide solutions based on basic principles that work regardless of the composition technology.

# Sentry support
As of August 2022 Sentry offers limited support for the MFE use case, therefore this repository will showcase _current_ solutions, best classified as workarounds. 

## Fundamental technical challenges
The nature of Javascript/browser environment presents significant obstacles to implementing first class support of MFEs in Sentry SDK. 

1. Javascript's concurrency model (single thread event loop) makes it very difficult for Sentry Javascript SDK to [maintain 'current hub' state](https://develop.sentry.dev/sdk/unified-api/#concurrency). (e.g. client code async waiting inside `Hub.run()`).

2. Sentry's reliance on **global event handlers** for catching errors in UI and async callbacks (`error`, `unhandledrejection`) as well as auto-instrumenting certain things, for example XHR breadcrumbs. Most **wrapper workarounds** (e.g. [mlmmn](https://github.com/getsentry/sentry-javascript/discussions/5217) or [ScriptedAlchemy](https://scriptedalchemy.medium.com/distributed-logging-in-federated-applications-with-sentry-f4249aa66e20)) forget that part and consequently only correctly route those errors that happen during component initialization when the page is loaded.

	2.1. When using frameworks, e.g. React, errors in component callbacks can be correctly captured using the framework facilities, e.g. React error boundaries. However a lot of the event-based asyncronous code will still rely on globabl event handlers and therefore escape the "walls" of the framework (except in Angular/Zone.js).

3. Loss of `function/file -> Component` mapping and function names during build process  (**lib** architecture).
## Current methods
Below is a list of desired feautres and whether a particular solution supports each. 

| Feature support / Method | [lib-1h2c-v6v7.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/lib-1h2c-v6.js) | [remote-1h2c-v6v7.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/remote-1h2c-v6v7.js) | [WrapALL](#wrapall) | [3premote-1h2c-v7.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/3premote-1h2c-v7.js)(experimental) |
| ------------------------ | ---------------- | ---- | ---- | ---- |
| Auto-assign to `micro` team               | **yes**  | **yes**  | **yes** | **yes** |
| Separate projects, quotas                 | **yes**  | **yes**  | **yes** | **yes** |
| Source mapping `micro`                    | **yes (tricky)****  | **yes**  | **yes** | **yes** | 
| No errors leak out of `micro` into `host` | **yes**  | **yes**  | **yes** | **yes** |
| Separate breadcrumbs, tags, context       | no | no  | no | no |
| React support                             | not impl. | not impl. | not impl. | not impl. |
| Performance `host`                        | **yes**  | **yes** | **yes** | **yes** |
| Performance: `host`-only spans in `host`  | no | no | no | no |
| Performance `micro`                       | no | no | no | no |
| Code change needed in `host`              | custom | **generic** | **none** | **none** |
| Works if `host` doesn't use Sentry        | no | no | no | **yes** |
| Supports multiple `micro` components      | ? | ? | **yes** | ? |

### What's "1h2c"?
One `Sentry.Hub`, two `Sentry.BrowserClient`'s. As opposed to creating multiple hubs, which is what some proposed solutions do.

### ** Source mapping (lib)
A **lib**-type `micro` can potentially have multiple `host` applications consuming it. Each `host` might use a different minification algorithm, serve `micro` code at different URL path or even bundle it together with other code into one big `.js` file. Naturally it is the responsibility of the `host` team to upload their source mappings during their build process, because `micro` team simply doesn't possess the information to generate those mappings. Source maps are associated with and uploaded for each individual release, each file can have only one mapping in a given release. This leaves room for a few options:

* Option 1 (recommended - less things can go wrote)
	* Each `host` build process registers its own releases of `micro` using Sentry API in the following format `v2.0.1.host1`. Then micro team can filter issues with a glob in the Sentry UI `v2.0.1.*`.
* Option 2 
	* Component owners (teams) make a contract to serve `micro` at a defined URL path, separate from all other code.
	* Additionally (assuming build toolchain supports this) `micro` ships pre-transpiled/minified.
	* `micro` team uploads their own source mappings.

### WrapALL
This method may be the best choice for **3premote** use case, because of its simplicity and the fact that it works without any change to the host-application code. The idea is to simply wrap all of `micro`'s entry points (including event handlers, anonymous function callbacks, etc.) in `try-catch` statements and then use a separate instance of Sentry client to report the errors to the right DSN/project. 
* Code snippet below assume that all of `micro`'s  host-applications use Sentry and that it's initialized at the time of `micro`'s initialization. If those assumptions don't always hold it may be necessary to put some if-statements to check and either wait for the host-sentry to be initialized or dynamically load Sentry SDK through injecting a script element.
```
var sentry_micro_client = new Sentry.BrowserClient({
 dsn: "https://abc54321@o12345.ingest.sentry.io/12345" 
 release: "my-project-name@2.3.12",
 transport: ("fetch" in window ? Sentry.makeFetchTransport : Sentry.makeXHRTransport)
}

var sentry_wrap = function(callback) {
	return () => {
		try {
			callback();
		} catch (e) {
			sentry_micro_client.captureException(e);
			// throw e; // if desired, host-sentry won't report it again
		}
	}
}

/* Component's entry point */
sentry_wrap(micro_widget_init)();

my_element.addEventListener('click', sentry_wrap(my_click_event_handler));

window.setTimeout(sentry_wrap(() => {
	// my code here
	// more code
}), 1000);

var req = new XMLHttpRequest();
req.addEventListener("load", sentry_wrap(() => {
	// my code here
	// more code	
}));
req.open("GET", "http://www.example.org/example.txt");
req.send();
```

### Experimental methods


# Sandbox how-to<a name="sandbox"></a>

To try out the sandbox:
```
git clone git@github.com:realkosty/sentry-micro-frontend.git
cd sentry-micro-frontend
python3 -m http.server
```
Then rename `env.js.example` to `env.js`, fill in your DSNs, releases and project links. 

Finally, open http://localhost:8000/

# Sandbox tips

Sandbox sets `mv` tag on all events sent to Sentry which is `<module>@<SDK version>`, for example:

```mv:lib-1h2c-v6v7@7.11.1```

Sandbox intercepts all `fetch` requests for sentry errors and logs them to console. So as long as you have "info" level enabled in your dev tools console you don't have to hunt for the right requests in the Network tab.

