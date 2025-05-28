#!/bin/bash

# Detectar a rede local automaticamente a partir da interface de rede
INTERFACE=$(ip route | grep default | awk '{print $5}')
IP_REDE=$(ip addr show $INTERFACE | grep inet | grep -v 127.0.0.1 | awk '{print $2}' | cut -d '/' -f 1)

# Verificar se foi possível detectar a rede local
if [ -z "$IP_REDE" ]; then
    echo "Não foi possível determinar a rede local! Verifique as configurações da interface de rede."
    exit 1
fi

# Obter o prefixo da rede (primeiros 3 octetos)
PREFIXO=$(echo $IP_REDE | cut -d '.' -f 1-3)

# Criar ou limpar o arquivo JSON onde os dispositivos serão guardados
echo "{" > dispositivos.json

# Pingar todos os IPs da rede
echo "Pingar os dispositivos..."
for ip in $(seq 1 254); do
    ip_ping="${PREFIXO}.${ip}"
    ping -c 1 -W 1 $ip_ping > /dev/null && echo "$ip_ping" >> ips_pingados &
done
wait

# Obter os MAC addresses dos IPs pingados
echo "A correlacionar IPs e MAC addresses..."
for ip in $(cat ips_pingados); do
    mac_address=$(ip neigh | grep $ip | awk '{print $5}')
    if [ -n "$mac_address" ]; then
        echo "IP: $ip - MAC: $mac_address"
        # Perguntar ao usuário se quer adicionar o dispositivo à rede
        read -p "Deseja adicionar este dispositivo à rede (sim/não)?" resposta
        if [[ "$resposta" == "sim" || "$resposta" == "s" ]]; then
            # Perguntar o nome para o dispositivo
            read -p "Qual o nome do dispositivo? " nome_dispositivo
            echo "$ip - $mac_address foi adicionado à rede com o nome '$nome_dispositivo'."

            # Salvar o dispositivo no ficheiro JSON
            echo "  \"$nome_dispositivo\": {\"IP\": \"$ip\", \"MAC\": \"$mac_address\"}," >> dispositivos.json
        else
            echo "$ip - $mac_address não foi adicionado."
        fi
    fi
done

# Fechar o JSON no ficheiro
echo "}" >> dispositivos.json

# Limpar ficheiro temporário
rm ips_pingados

echo "Dispositivos foram salvos em dispositivos.json."
