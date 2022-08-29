# Summary
What is this repo?
* A **sandbox** for testing Sentry integration in [Micro-frontent (MFE)](https://micro-frontends.org/) architecture. (including both true, i.e. remote, MFEs and traditional build-time libraries)
	* See [Sandbox how-to](#sandbox)
* A **collection of code snippets** (["methods"](https://github.com/realkosty/sentry-micro-frontend/tree/main/methods)) 
* **This documentation**. Keep on reading.

# Problem Overview
Micro-frontend is pattern in web application design where a single user-facing application is composed of 2 or more separate frontend components each owned (and in the case of true, remote MFEs - also deployed and operated) by a separate team. In this architecture the goal is to allow each component-owner team to build with maximum independence. Naturally the developers want the errors from different components **go into their own separate Sentry projects/DSNs**. Unfortunately, the naive approach of importing `@sentry/browser` and calling `Sentry.init()` in every component does not work.

We use the term Micro-frontend to describe 2 distinct architectures:
* **True (remote) micro-frontends**: components are built, deployed and served separately. Often associated with Webpack's module federation.[^1]
*  **Library** (lib) components are package dependencies included (`npm, yarn`) during `[host]` app's build process. They are deployed together with the host app and served from the same origin and sometimes even the same bundle file. 

There is no (fundamental) difference from the browser runtime perspective. However, when it comes to the dev process, the two couldn't be further apart:
| | remote | lib |
| --- | --- | --- |
| Component-level ownership | yes |  yes |
| `micro`[^2] team controls their code's deployment to prod | yes | no |
| `micro` team controls their code's minification and URL paths | yes | no |

This last difference is of huge imporance when integrating Sentry. It turns out that **library** architecture presents some unique. 

[^1]: Since this is a new and evolving space we try, whenever possible, to provide solutions based on basic principles that work regardless of the composition technology.
[^2]: We refer to top level web application that consumes individual (either **"remote"** or **"lib"**) components developed by different teams as `host` and non-host components themselves as `micro`'s.

# Sentry support
As of August 2022 Sentry offers limited support for the MFE use case, therefore this repository will showcase _current_ solutions, best classified as workarounds. 

## Fundamental technical challenges
The nature of Javascript/browser environment presents significant obstacles to implementing first class support of MFEs in Sentry SDK. 

1. Javascript's concurrency model (single thread event loop) makes it very difficult for Sentry Javascript SDK to [maintain 'current hub' state](https://develop.sentry.dev/sdk/unified-api/#concurrency). (e.g. client code async waiting inside `Hub.run()`).

2. Sentry's reliance on **global event handlers** for catching errors in UI and async callbacks (`error`, `unhandledrejection`) as well as auto-instrumenting certain things, for example XHR breadcrumbs. Most **wrapper workarounds** (e.g. [mlmmn](https://github.com/getsentry/sentry-javascript/discussions/5217) or [ScriptedAlchemy](https://scriptedalchemy.medium.com/distributed-logging-in-federated-applications-with-sentry-f4249aa66e20)) forget that part and consequently only correctly route those errors that happen during component initialization when the page is loaded.

	2.1. When using frameworks, e.g. React, errors in component callbacks can be correctly captured using the framework facilities, e.g. React error boundaries. However a lot of the event-based asyncronous code will still rely on globabl event handlers and therefore escape the "walls" of the framework (except in Angular/Zone.js).

3. Loss of `function/file -> Component` mapping and function names during build process  (**lib** architecture).
## Current methods (remote)
TBD. This is a piece of cake compared to **lib**: basically like lib-1h2c-v6.js have `micro` provide their own callback to match URL/origin in `host`'s `beforeSend()`.

## Current methods (lib)

Below is a list of desired feautres and whether a particular solution supports each. 

| Feature support / Method | [lib-1h2c-v6.js](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/lib-1h2c-v6.js) | [remote-1h2c-v6v7](https://github.com/realkosty/sentry-micro-frontend/blob/main/methods/lib-1h2c-v6.js) |
| ------------------------ | ---------------- | ---- |
| Auto-assign to `micro` team  | **yes**  | **yes**  |
| Separate projects, quotas  | **yes**  | **yes**  |
| Source mapping `micro` | **yes (tricky)****  | **yes**  |
| No errors leak out of `micro` into `host`  | **yes**  | **yes**  |
| Separate breadcrumbs, tags, context | no | no  |
| React support  | not impl. | not impl. |
| Performance `host`  | **yes**  | **yes** |
| Performance: `host`-only spans in `host`  | no | no |
| Performance `micro` | no | no |
| Code change needed in `host` (none/generic/custom) | custom | **generic** |

### What's "1h2c"?
One hub, two clients. 

### ** Source mapping
A **lib**-type `micro` can potentially have multiple `host` applications consuming it. Each `host` might use a different minification algorithm, serve `micro` code at different URL path or even bundle it together with other code into one big `.js` file. Naturally it is the responsibility of the `host` team to upload their source mappings during their build process, because `micro` team simply doesn't possess the information to generate those mappings. Source maps are associated with and uploaded for each individual release, each file can have only one mapping in a given release. This leaves room for a few options:

* Option 1 (recommended - less things can go wrote)
	* Each `host` build process registers its own releases of `micro` using Sentry API in the following format `v2.0.1.host1`. Then micro team can filter issues with a glob in the Sentry UI `v2.0.1.*`.
* Option 2 
	* Component owners (teams) make a contract to serve `micro` at a defined URL path, separate from all other code.
	* Additionally (assuming build toolchain supports this) `micro` ships pre-transpiled/minified.
	* `micro` team uploads their own source mappings.

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

