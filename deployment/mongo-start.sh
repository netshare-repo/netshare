#!/bin/bash
set -euo pipefail
install -o mongodb -g mongodb -m 400 /run/secrets/mongodb_keyfile /data/configdb/netshare-keyfile
exec /usr/local/bin/docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile /data/configdb/netshare-keyfile
