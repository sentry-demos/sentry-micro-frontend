# Summary
What is this repo?
- A **sandbox** for testing different methods to make Sentry work within a family of web application architectures collectively referred to as [Micro-frontend (MFE)](https://micro-frontends.org/). 
	* See [Sandbox how-to](#sandbox)
- A **collection of code snippets** inside (["methods/"](https://github.com/realkosty/sentry-micro-frontend/tree/main/methods)) directory which are documented below, in [Current Methods](#current-methods)
- **This documentation**. 
  - [Problem Overview](#problem-overview)
  - [Sentry support](#sentry-support)
    - [Current Methods](#current-methods)
    - [Fundamental technical challenges](#fundamental-technical-challenges)
  - [Sandbox how-to](#sandbox-how-to)
  - [Sandbox tips](#sandbox-tips)

# Problem Overview
Micro-frontend is not a specific technology, but rather a concept (or buzzword). Modeled after the idea of microservices vs monolith backend, it is a design pattern where a single user-facing web application is composed of 2 or more separate frontend components each owned (and in the case of true, remote, MFEs - also deployed and operated) by a separate team. The goal is to allow each component-owner team to build and ship independently. Naturally, the developers want the errors from different components **go into their own separate Sentry projects/DSNs**. Unfortunately, the naive approach of calling `Sentry.init()` in each component does not work.

Not everyone uses the term "micro-frontend". Developers may describe their micro-component (or `micro`) as **widget, plugin, library or module**. Typically, there is a top-level component responsible for tying everything together into a single user-facing web app, which we refer to as **host-application or host**. Sometimes a `micro` is consumed by multiple hosts (as in 3rd party scenario described later).

There are 4 subtypes of this architecture. There is no (fundamental) difference between these 4 types from the browser runtime perspective. However, when it comes to integrating Sentry, each has its own distinct requirements and obstacles:

|  |  | 
| --- | --- |
| remote | lib |
| 3premote | 3plib |

* **True (remote) micro-frontends**: components are built, deployed and served separately. Often associated with Webpack's module federation.[^1]
*  **Library** (lib) components are package dependencies included (`npm, yarn`) during host-application's build process. They are deployed together with the host app and served from the same origin and sometimes even the same bundle file. 

On top of that, components may be owned by:
* **Same org** (remote, lib) `host` and `micro` are owned by different teams within the same company.
* **3rd Party** (3premote, 3plib) Typically multiple `host` apps owned by separate 3rd party companies who are `micro`'s customers.

| | remote | lib | 3premote | 3plib |
| --- | --- | --- | --- | --- | 
| Component-level ownership | yes |  yes | yes | yes |
| `micro` team controls their code's deployment to prod | yes | no | yes | no |
| `micro` team controls their code's minification and URL paths | yes | no | yes | no |
| Code changes in the `host` are undesirable | no | no | yes | yes |

[^1]: Since this is a new and evolving space we try, whenever possible, to provide solutions based on basic principles that work regardless of the composition technology.

# Sentry support
As of August 2022 Sentry does not officially support MFE use case. 

See [Fundamental technical challenges](#fundamental-technical-challenges) to understand why.

This repository documents current workarounds (aka methods). 

## Current methods

All the code included in this repository is intended as example only and should NOT be adopted for use in production software without first undergoing full review and rigorous testing. This code is provided on an "AS-IS" basis without warranty of any kind, either express or implied, including without limitation any implied warranties of condition, uninterrupted use, merchantability, fitness for a particular purpose, or non-infringement. The details of your application or component, architecture of the host-application, and your target browser support, among many other things, may require you to modify this code. Issues regarding these code examples should be submitted through GitHub.

| Feature support and limitations | [simple-lib.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/simple-lib.js) | [simple-remote.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/simple-remote.js) | [WrapALL](#wrapall-method) | [flex-micro.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/flex-micro.js)|
| ------------------------ | ---------------- | ---- | ---- | ---- |
| Supported use cases                       | lib | remote | lib<br />3plib<br />remote<br /> 3premote | remote<br />3premote |
| Recommended for use case                  | lib | - | 3premote<br />remote (2+ MICROs) | remote (1 MICRO) |
| Sentry SDK support                        | v7, v6 | v7, v6 | v7, v6 | v7, (v6?) |
| Separate projects                 	    | **yes**  | **yes**  | **yes** | **yes** |
| No errors leak from MICRO<br />into HOST project | **yes**  | **yes**  | **yes** | [**yes*****](#-flex-minimal-error-leakage) |
| Source mapping MICRO                    | [**yes (tricky)***](#-source-mapping-lib)  | **yes**  | **yes** | **yes** | 
| Works if `host` doesn't use Sentry        | [no**](#-no-host-sentry) | [no**](#-no-host-sentry) | [no**](#-no-host-sentry) | **yes** |
| Works if MICRO initialized<br />before HOST Sentry loaded | [no**](#-no-host-sentry) | [no**](#-no-host-sentry) | [no**](#-no-host-sentry) | **yes** |
| Works if MICRO and HOST use<br />different versions of Sentry | no,<br />might break | no,<br />might break | no,<br />might break | **yes, defers to<br />HOST version** |
| Works if more than 1 MICRO-component      | not impl. | not impl. | **yes** | ? |
| Code change needed in HOST              | **yes, custom** | **yes, generic** | no | no |
| Requires broad application code changes   | no | no | **yes,<br />in micro** | no |
| Separate breadcrumbs, tags, context       | no | no  | **possibly,**<br />with [mlmmn's code](https://github.com/getsentry/sentry-javascript/discussions/5217)<br />(not tested) | no |
| React support                             | not impl. | not impl. | not impl. | not impl. |
| Performance (see footnote †)                | `H,M->Hp 0->Mp` | `H,M->Hp 0->Mp` | `H,M->Hp 0->Mp` | `H,M->Hp 0->Mp` |

- ***not impl.** = possible, but not implemented yet*
- ***no** = not feasible with this approach*
- ***?** = feasibility has not been evaluated yet*
- **† `H,M->Hp 0->Mp`** means HOST transactions/spans (H) and MICRO transactions/spans (M) go into Host-project, nothing (0) send to Micro-project (Mp)

### * Source mapping (lib)
A **lib**-type `micro` can potentially have multiple `host` applications consuming it. Each `host` might use a different minification algorithm, serve `micro` code at different URL path or even bundle it together with other code into one big `.js` file. Naturally it is the responsibility of the `host` team to upload their source mappings during their build process, because `micro` team simply doesn't possess the information to generate those mappings. Source maps are associated with and uploaded for each individual release, each file can have only one mapping in a given release. This leaves room for a few options:

* Option 1 (recommended - less things can go wrong)
	* Each `host` build process registers its own releases of `micro` using Sentry API ~~in the following format `v2.0.1.host1`. Then micro team can filter issues with a glob in the Sentry UI `v2.0.1.*`.~~
    * Look into `dist` flag:  [docs/sourcemaps/troubleshooting](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifact-distribution-value-matches-value-configured-in-your-sdk) and [docs/cli/releases/--dist](https://docs.sentry.io/product/cli/releases/#:~:text=%2D%2Ddist,a%20single%20release.)
* Option 2 
	* Component owners (teams) make a contract to serve `micro` at a defined URL path, separate from all other code.
	* Additionally (assuming build toolchain supports this) `micro` ships pre-transpiled/minified.
	* `micro` team uploads their own source mappings.

### ** No host Sentry
The problem here is how do you know for sure that `host` is never loading Sentry or just didn't have a chance yet. You can have a timeout but then either delay `micro`'s widgets own initialization or miss on reporting errors that occur while you waiting. In [flex-micro.js it is handled by patching temporary queueing handlers](https://github.com/realkosty/sentry-micro-frontend/blob/94ef7b374fb939b73a6d6b9b4f5c742114e2c7fd/methods/flex-micro.js#L433) but at that point you could as well implement the entire `flex-micro`.

### WrapALL method
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

### \*\*\* Flex: minimal error leakage
In one unlikely circumstance `flex-micro.js` will leak the very first error into `host` project/DSN. This will happen if (1) at the time of `micro`'s initialization `host`-Sentry has not only not been initialized yet but the SDK hasn't even been loaded. In that situation whe can not detect the exact moment Sentry.init() is called and only detect it when 1 error may have already been incorrectly reported to `host`. (TODO: would it be possible to patch `onload` events of all <script> elements on the page to detect that?).

## Fundamental technical challenges
The nature of Javascript/browser environment presents significant obstacles to implementing first class support of MFEs in Sentry SDK. 

1. Javascript's concurrency model (single thread event loop) makes it very difficult for Sentry Javascript SDK to [maintain 'current hub' state](https://develop.sentry.dev/sdk/unified-api/#concurrency). (e.g. client code async waiting inside `Hub.run()`).

2. Sentry's reliance on **global event handlers** for catching errors in UI and async callbacks (`error`, `unhandledrejection`) as well as auto-instrumenting certain things, for example XHR breadcrumbs. Most **wrapper workarounds** (e.g. [mlmmn](https://github.com/getsentry/sentry-javascript/discussions/5217) or [ScriptedAlchemy](https://scriptedalchemy.medium.com/distributed-logging-in-federated-applications-with-sentry-f4249aa66e20)) forget that part and consequently only correctly route errors originating in the code that was explicitly wrapped (see [WrapALL](#wrapall-method)). That eliminates one of the big benefits of Sentry - not having to manually instrument things.

	2.1. When using frameworks, e.g. React, errors in component callbacks can be correctly captured using the framework facilities, e.g. React error boundaries. However a lot of the event-based asyncronous code will still rely on globabl event handlers and therefore escape the "walls" of the framework (except in Angular/Zone.js).

3. Loss of `function/file -> Component` mapping and function names during build process  (**lib** architecture).


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

```mv:simple-libv7@7.11.1```

