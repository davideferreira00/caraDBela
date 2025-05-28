#!/bin/bash

# Detectar interface de rede ativa
INTERFACE=$(ip route | grep default | awk '{print $5}')
IP_REDE=$(ip addr show $INTERFACE | grep inet | grep -v 127.0.0.1 | awk '{print $2}' | cut -d '/' -f 1)

if [ -z "$IP_REDE" ]; then
    echo "Não foi possível determinar a rede local! Verifique as configurações da interface de rede."
    exit 1
fi

PREFIXO=$(echo $IP_REDE | cut -d '.' -f 1-3)
> ips_pingados

echo "A procurar dispositivos na rede..."
for ip in $(seq 1 254); do
    ip_ping="${PREFIXO}.${ip}"
    ping -c 1 -W 1 $ip_ping > /dev/null && echo "$ip_ping" >> ips_pingados &
done
wait

declare -a dispositivos

echo "A correlacionar IPs e MAC addresses..."
for ip in $(cat ips_pingados); do
    mac_address=$(ip neigh show "$ip" | awk '/lladdr/ {print $5; exit}')
    if [ -n "$mac_address" ]; then
        hostname=$(nslookup $ip | grep 'name =' | awk '{print $4}' | sed 's/\.$//')
        echo "IP: $ip - MAC: $mac_address - Nome detetado: ${hostname:-Desconhecido}"

        read -p "Deseja adicionar este dispositivo à rede (sim/não)? " resposta
        if [[ "$resposta" == "sim" || "$resposta" == "s" ]]; then
            read -p "Nome para o dispositivo [${hostname:-sem nome}]: " nome_dispositivo
            nome_dispositivo=${nome_dispositivo:-$hostname}
            echo "$ip - $mac_address foi adicionado com o nome '$nome_dispositivo'."

            # Guardar no array
            dispositivos+=("\"$nome_dispositivo\": {\"IP\": \"$ip\", \"MAC\": \"$mac_address\"}")
        else
            echo "$ip - $mac_address não foi adicionado."
        fi
    fi
done

# Construir JSON corretamente
echo "{" > dispositivos.json
for i in "${!dispositivos[@]}"; do
    if [ "$i" -lt $((${#dispositivos[@]} - 1)) ]; then
        echo "  ${dispositivos[$i]}," >> dispositivos.json
    else
        echo "  ${dispositivos[$i]}" >> dispositivos.json
    fi
done
echo "}" >> dispositivos.json

rm ips_pingados
echo "Dispositivos foram salvos em dispositivos.json."
