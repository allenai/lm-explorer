#!/usr/bin/env bash

host=$1
if [[ -z "$host" ]]; then
  host="https://lm-explorer.apps.allenai.org"
fi

#
# ab, my favorite load testing mechanism
#
# -p predict.json       POST the provided JSON file
# -c 20                 make 20 requests at once
# -n 1000               make 1000 requests in total
# -l                    if the response length varies, it's normal, don't treat
#                       it as an error
# -T application/json   let the API know we're sending JSON
#
ab -p predict.json -c 20 -n 1000 -l -T application/json "$host/predict"
