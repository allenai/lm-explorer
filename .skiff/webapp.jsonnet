/**
 * This file is a template that's used to generate the Kubernetes manifest
 * for your application. It's a jsonnet file, which you can learn more
 * about via https://jsonnet.org/.
 *
 * This file defines the manifest for a simple web application. It's composed
 * by the following pieces:
 *  - Your Namespace, a way to group the resources related to your application
 *    so that they're nicely isolated from those related to other apps.
 *  - An Ingress definition, which tells Kubernetes what traffic to route to
 *    your web application and what protocols to use. It also sets up TLS,
 *    which ensures communications between the client and your app are securely
 *    encrypted.
 *  - A Deployment, which tells Kubernetes to run multiple versions of your
 *    application and what code to run.
 *  - A Service, which tells Kubernetes that your application can be exposed
 *    to traffic outside of the cluster.
 *
 * This file expects the following external variables to be defined:
 *  - image {string}    An identifier for the docker image to run. Any valid
 *                      docker tag and/or sha is appropriate, i.e. my-app:latest
 *                      or my-app:sha256.
 *  - env   {string}    An identifier for the environment. If the value is 'prod',
 *                      then the top-level domain, 'appName.apps.allenai.org'
 *                      is associated with the deployment.
 *  - sha   {string}    The GIT SHA of the code being built and deployed.
 *
 * This file exptects a config.json file to exist in the same directory with
 * the following parameters:
 *  - appName   {string}    A unique name identifying the application.
 *  - httpPort  {number}    The port on which your application listens for HTTP
 *                          traffic.
 *  - contact   {string}    An @allenai.org email address that can be contacted
 *                          for matters related to the application. Note, the
 *                          '@allenai.org' suffix is not present in the value,
 *                          as Kubernetes labels don't accept the '@' character.
 */

// This file is generated once at template creation time and unlikely to change
// from that point forward.
local config = import 'config.json';

// These values are provided at runtime.
local env = std.extVar('env');
local image = std.extVar('image');
local sha = std.extVar('sha');

local topLevelDomain = '.apps.allenai.org';

// We only allow registration of hostnames attached to '*.apps.allenai.org'
// at this point, as that's all our certmanager can (easily) handle. At one
// point we may support additional domain names. If you support for this, let
// us know! https://github.com/allenai/skiff/issues/new
local hosts = [
    if env == 'prod' then
        config.appName + topLevelDomain
    else
        config.appName + '.' + env + topLevelDomain
];

local replicas = 0;

// Each app gets it's own namespace
local namespaceName = config.appName;

// Since we deploy resources for different environments in the same namespace,
// we need to give things a fully qualified name that includes the environment
// as to avoid unintentional collission / redefinition.
local fullyQualifiedName = config.appName + '-' + env;

// Every resource is tagged with the same set of labels. These labels serve the
// following purposes:
//  - They make it easier to query the resources, i.e.
//      kubectl get pod -l app=my-app,env=staging
//  - The service definition uses them to find the pods it directs traffic to.
local labels = {
    app: config.appName,
    env: env,
    contact: config.contact,
    team: config.team
};

local namespace = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
        name: namespaceName,
        labels: labels
    }
};

local ingress = {
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata: {
        name: fullyQualifiedName,
        namespace: namespaceName,
        labels: labels,
        annotations: {
            'certmanager.k8s.io/cluster-issuer': 'letsencrypt-prod',
            'kubernetes.io/ingress.class': 'nginx',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
            'nginx.ingress.kubernetes.io/enable-cors': 'false',
            'nginx.ingress.kubernetes.io/limit-rps': '1'
        }
    },
    spec: {
        tls: [
            {
                secretName: fullyQualifiedName + '-tls',
                hosts: hosts
            }
        ],
        rules: [
            {
                host: host,
                http: {
                    paths: [
                        {
                            backend: {
                                serviceName: fullyQualifiedName,
                                servicePort: config.httpPort
                            }
                        }
                    ]
                }
            } for host in hosts
        ]
    }
};

// The `readinessProbe` begins on pod start and determines whether the pod can accept traffic.
// When an application is not ready traffic will instead go to other ready pods.
// A live pod can also become unready again if the probe fails `failureThreshold` times.
local readinessProbe = {
    failureThreshold: 9,
    periodSeconds: 30,
    initialDelaySeconds: 120,  // Use a longer delay if your app loads a large model.
    httpGet: {
        path: '/',
        port: config.httpPort,
        scheme: 'HTTP',
    },
};

// The `livenessProbe` begins on application start and determines whether to kill the pod.
// If the `livenessProbe` fails `failureThreshold` times, the pod is killed and restarted by
// Kubernetes.
local livenessProbe = {
    initialDelaySeconds: 120,  // Use a longer delay if your app loads a large model.
    tcpSocket: {
        port: config.httpPort
    }
};

local deployment = {
    apiVersion: 'extensions/v1beta1',
    kind: 'Deployment',
    metadata: {
        labels: labels,
        name: fullyQualifiedName,
        namespace: namespaceName,
    },
    spec: {
        revisionHistoryLimit: 3,
        replicas: replicas,
        strategy: {
            rollingUpdate: {
                # Let k8s spin up a full set of replicas since they take so long to
                # initialize
                maxSurge: 1,
                maxUnavailable: 0
            },
            type: "RollingUpdate"
        },
        template: {
            metadata: {
                name: fullyQualifiedName,
                namespace: namespaceName,
                labels: labels
            },
            spec: {
                containers: [
                    {
                        name: config.appName,
                        image: image,
                        readinessProbe: readinessProbe,
                        livenessProbe: livenessProbe,
                        resources: {
                            requests: {
                                // Our machines currently have 2 vCPUs, so this
                                // will allow 4 apps to run per machine
                                cpu: '1',
                                // Each machine has 13 GB of RAM. We target 4
                                // apps per machine, so we reserve 3 GB of RAM
                                // for each (whether they use it our not).
                                memory: '6Gi'
                            }
                        },
                        env: [
                            {
                                name: 'GIT_SHA',
                                value: sha
                            },
                            {
                                name: 'GOOGLE_ANALYTICS_UA',
                                value: 'UA-120916510-4'
                            }
                        ]
                    }
                ]
            }
        }
    }
};

local service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
        name: fullyQualifiedName,
        namespace: namespaceName,
        labels: labels
    },
    spec: {
        selector: labels,
        ports: [
            {
                port: config.httpPort,
                name: 'http'
            }
        ]
    }
};

[
    namespace,
    ingress,
    deployment,
    service
]
