FROM nginx:1.17.6-alpine

COPY redirect.conf /etc/nginx/conf.d/default.conf
