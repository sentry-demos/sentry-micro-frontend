#!/bin/bash

mkdir build1
find . -iname '*.js' -o -iname '*.css' -o -iname '*.html' -o -iname '*.ico' \
  | cpio -updm ./build1 


RELEASE=$1

sentry-cli releases new $RELEASE

cd ./build1/
sentry-cli releases files $RELEASE upload-sourcemaps . \
    --ext map \
    --ext js \
    --rewrite

sentry-cli releases finalize $RELEASE
