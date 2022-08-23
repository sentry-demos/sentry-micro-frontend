import './init.js';

/*
 * Credit: https://github.com/mlmmn 
 *
 * Adapted from https://github.com/getsentry/sentry-javascript/discussions/5217#discussioncomment-2898004
 */

// NOTE: see recreate_supportsFetch() comment
//import {supportsFetch} from '@sentry/utils';


window.SENTRY_INIT_METHODS["mlmmn-v7"] = {
  init_host_sentry:  function(tracing, debug, initialScope) {
                Sentry.init({
                    dsn: HOST_DSN,
                    release: HOST_RELEASE,
                    debug: debug,
                    integrations: tracing ? [new Sentry.BrowserTracing()] : [],
                    tracesSampleRate: 1.0,
                    initialScope: initialScope,
                    beforeSend: (event, hint) => {
                      /* TODO parametrize micro module file name below - */
                      if (hint.originalException.stack.match(/\/micro(\.min)?\.js/)) {
                        window.SentryMicro.captureException(event.exception);
                        return null;
                      }
                      return event;
                    }
                });
              },

  init_micro_sentry: function(tracing, debug, initialScope) {
    /* This code creates a window.SentryMicro object 
     * that internally uses its own hub and client. */ 

    const _linkedErrors = new Sentry.Integrations.LinkedErrors();
    //let _dedupe_ep;
    //new Sentry.Integrations.Dedupe().setupOnce((ep) => {_dedupe_ep = ep;}, Sentry.getCurrentHub);
    let _previousEvent;

    /* TODO: initialScope */
    const _client = new Sentry.BrowserClient({
      dsn: MICRO_DSN ,
      release: MICRO_RELEASE,
      defaultIntegrations: false, // Won't work with multiple client setup anyway
      /* BaseClient constructor will break in 7.11.1 unless we set this
       * https://github.com/getsentry/sentry-javascript/blob/f563eae7e032f2b3d71147be922f95d98babdcb1/packages/browser/src/sdk.ts#L114 */
      transport: recreate_supportsFetch() ? Sentry.makeFetchTransport : Sentry.makeXHRTransport,
      /* must be defined */
      integrations: [],
      beforeSend(event, hint) {
        
        if (recreateDedupe(event)) {
          return null;
        }
        _previousEvent = event;

        const enrichedEvent = {};
        /* Sentry integrations (breadcrumbs, user agent and so on) currently do not work when using multiple
         * clients (meaning initializing Sentry like above, not by Sentry.init()). This is said to be fixed
         * in Sentry client v7 according to the GitHub issue https://github.com/getsentry/sentry-javascript/issues/2732
         * Until v7 is released, some functionality like breadcrumbs and user agent info have to be manually recreated.
         */
        recreateLinkedErrors(enrichedEvent);
        recreateUserAgent(enrichedEvent);
        recreateBreadcrumbs(enrichedEvent);

        return enrichedEvent;
      },
    });
    
    const _hub = new Sentry.Hub(_client);

    
    // The actual client that is exported
    window.SentryMicro = {
      addBreadcrumb: (breadcrumb, hint) => _hub.addBreadcrumb(breadcrumb, hint),
      setUser: (user) => _hub.setUser(user),
      setTags: (tags) => _hub.setTags(tags),

      captureException: (exception, captureContext) => {
        const breadcrumbs = getBreadcrumbs();

        _hub.run((currentHub) => {
          currentHub.withScope((scope) => {
            breadcrumbs.forEach((breadcrumb) => {
              scope.addBreadcrumb(breadcrumb);
            });

            const error =
              exception instanceof Error ? exception : new Error(exception.message || "Unknown error");

            currentHub.captureException(error, {
              originalException: error,
              captureContext,
            });
          });
        });
      },

      captureMessage: (message, level, captureContext) => {
        const breadcrumbs = getBreadcrumbs();
        _hub.run((currentHub) => {
          currentHub.withScope((scope) => {
            breadcrumbs.forEach((breadcrumb) => {
              scope.addBreadcrumb(breadcrumb);
            });
            currentHub.captureMessage(message, level, { captureContext });
          });
        });
      },
    };
    
    function recreateDedupe(event) {
          return _dedupe._shouldDropEvent(event, _previousEvent);
    }


    function recreateLinkedErrors(enrichedEvent) {
        Object.assign(enrichedEvent, _linkedErrors._handler(event, hint));
    }

    function recreateUserAgent(enrichedEvent) {
        if (window.navigator && window.location && window.document) {
          const url = enrichedEvent.request?.url || window.location?.href;
          const { referrer } = window.document || {};
          const { userAgent } = window.navigator || {};

          const headers = {
            ...enrichedEvent.request?.headers,
            ...(referrer && { Referer: referrer }),
            ...(userAgent && { "User-Agent": userAgent }),
          };
          const request = { ...(url && { url }), headers };

          enrichedEvent.request = { ...enrichedEvent.request, ...request };
        }
    }

    function recreateBreadcrumbs(enrichedEvent) {
        enrichedEvent.breadcrumbs = enrichedEvent.breadcrumbs
          ?.filter((breadcrumb) => !shouldIgnoreBreadcrumb(breadcrumb))
          .sort((a, b) => {
            if (a.timestamp && b.timestamp) {
              return a.timestamp - b.timestamp;
            }
            return 0;
          });
    }

    function getBreadcrumbs() {
      // Obtain breadcrumbs from global Sentry hub instance in host app
      let bc = Sentry.getCurrentHub().getScope()._breadcrumbs 
      return bc !== null && bc !== void 0 ? bc : [];

    }
  }
};

/* Not available in CDN bundle, preferred method is to use
 * 
 * import {supportsFetch} from '@sentry/utils';
 */
function recreate_supportsFetch() {
  if (!('fetch' in window)) {
    return false;
  }

  try {
    new Headers();
    new Request('');
    new Response();
    return true;
  } catch (e) {
    return false;
  }
}

