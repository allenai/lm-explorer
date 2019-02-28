#!/bin/bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# If $PROJECT_ID is set, we're running in Google Cloud Build, which means
# we need to invole /builder/kubectl.bash instead of the standard kubectl.
# This is because /builder/kubectl.bash includes the right configuration
# for authenticating against the target cluster.
kubectl_cmd="kubectl"
if [[ ! -z "$CLOUDSDK_COMPUTE_ZONE" ]]; then
  kubectl_cmd="/builder/kubectl.bash"
fi

usage() {
  echo ""
  echo "Usage:"
  echo "  ./deploy.sh IMAGE"
  echo ""
  echo "  IMAGE   the image version to deploy, i.e. gcr.io/ai2-reviz/lm-explorer:latest"
  echo ""
}

echo "using '$kubectl_cmd'…"

# Figure out the image we'd like to deploy, and complain if it's empty.
image=$1
if [[ -z "$image" ]]; then
  echo "Error: no image specified."
  usage
  exit 1
fi

set +e
$kubectl_cmd get namespace/lm-explorer &> /dev/null
namespace_exists=$?
set -e
if [[ "$namespace_exists" != "0" ]]; then
  echo "creating lm-explorer namespace…"
  $kubectl_cmd create namespace lm-explorer
else
  echo "namespace lm-explorer already exists…"
fi;

echo "deploying '$image'…"

# Deploy the latest UI
sed "s#%IMAGE%#$image#g" < $dir/kube.yaml | $kubectl_cmd apply -f -
