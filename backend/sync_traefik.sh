#!/bin/bash
while true; do
  ROUTERS=""
  SERVICES=""
  
  for container in $(docker ps -q --filter "label=traefik.enable=true"); do
    name=$(docker inspect -f '{{.Config.Image}}' $container | cut -d: -f1)
    ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $container | head -n 1)
    
    # Extract the rule Host(`...`)
    rule=$(docker inspect -f '{{index .Config.Labels "traefik.http.routers.'$name'.rule"}}' $container)
    
    if [ ! -z "$rule" ] && [ ! -z "$ip" ] && [ "$rule" != "<no value>" ]; then
      ROUTERS="$ROUTERS
    $name:
      rule: \"$rule\"
      service: $name"
      
      SERVICES="$SERVICES
    $name:
      loadBalancer:
        servers:
          - url: \"http://$ip:80\""
    fi
  done
  
  echo "http:" > traefik_config/dynamic/routes.tmp
  echo "  routers:$ROUTERS" >> traefik_config/dynamic/routes.tmp
  echo "  services:$SERVICES" >> traefik_config/dynamic/routes.tmp
  mv traefik_config/dynamic/routes.tmp traefik_config/dynamic/routes.yml
  
  sleep 3
done
