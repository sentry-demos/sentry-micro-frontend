import './init.js';

/* All the code included in this repository is intended as example only and should NOT be
 * adopted for use in production software without first undergoing full review and rigorous 
 * testing. This code is provided on an "AS-IS" basis without warranty of any kind, either 
 * express or implied, including without limitation any implied warranties of condition, 
 * uninterrupted use, merchantability, fitness for a particular purpose, or non-infringement.
 * The details of your application or component, the architecture of the host-application, 
 * and your target browser support, among many other things, and may require you to modify 
 * this reference code. Issues regarding these code examples should be submitted through GitHub.
 *
 * THIS METHOD DOESN'T WORK
 *
 * It's intended as illustration of what doesn't work.
 */

window.SENTRY_INIT_METHODS["naive"] = {
  init_host_sentry:  function(tracing, debug) {
                Sentry.init({
                    dsn: HOST_DSN,
                    release: HOST_RELEASE,
                    debug: debug,
                    integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                    tracesSampleRate: 1.0,
                });
              },
  init_micro_sentry: function(tracing, debug) {
                Sentry.init({
                  /* This is DSN for [micro], different from [host] DSN */
                  dsn: MICRO_DSN,
                  release: MICRO_RELEASE,
                  debug: debug,
                  integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                  tracesSampleRate: 1.0,
                });
              }
};

