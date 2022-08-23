#!/bin/bash

#gcloud alpha storage cp --recursive . gs://www.sentry-micro-frontend.net
gsutil rsync -x "^\..*|.*/\..*|^deploy\.sh$|^README\.md$" -R . gs://www.sentry-micro-frontend.net

# RUN THIS ONCE (rsync preserves metadata)
#gsutil -m setmeta -h "Cache-Control: no-store" -r gs://www.sentry-micro-frontend.net/


