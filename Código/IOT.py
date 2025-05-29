import subprocess
import socket
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except:
        ip = None
    finally:
        s.close()
    return ip

def ping(ip):
    try:
        resultado = subprocess.run(
            ["ping", "-n", "1", "-w", "800", ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return ip if resultado.returncode == 0 else None
    except:
        return None

def get_mac(ip):
    try:
        output = subprocess.check_output(["arp", "-a", ip], text=True)
        for line in output.splitlines():
            if ip in line:
                partes = line.split()
                for parte in partes:
                    if "-" in parte and len(parte) == 17:
                        return parte
    except:
        pass
    return "Desconhecido"

def get_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except:
        return "Desconhecido"

def main():
    ip_local = get_local_ip()
    if not ip_local:
        print("Erro: Não foi possível obter o IP local.")
        return

    prefixo = ".".join(ip_local.split(".")[:3])
    print(f"IP local detetado: {ip_local}")
    print("A procurar dispositivos ativos na rede...")

    ativos = []
    with ThreadPoolExecutor(max_workers=100) as executor:
        futuros = [executor.submit(ping, f"{prefixo}.{i}") for i in range(1, 255)]
        for futuro in as_completed(futuros):
            ip = futuro.result()
            if ip:
                ativos.append(ip)

    if not ativos:
        print("Nenhum dispositivo encontrado na rede.")
        return

    dispositivos = {}

    for ip in ativos:
        mac = get_mac(ip)
        hostname = get_hostname(ip)
        print(f"\nIP: {ip} | MAC: {mac} | Nome: {hostname}")

        resposta = input("Este dispositivo pertence à rede? (sim/não): ").strip().lower()
        if resposta in ["sim", "s"]:
            nome = input(f"Nome personalizado (ou ENTER para manter '{hostname}'): ").strip()
            if not nome:
                nome = hostname
            dispositivos[nome] = {"IP": ip, "MAC": mac}
            print(f"Dispositivo '{nome}' adicionado com sucesso.")
        else:
            print(f"O IP {ip} não foi adicionado.")

    with open("dispositivos.json", "w", encoding="utf-8") as f:
        json.dump(dispositivos, f, indent=4)

    print("\nTodos os dispositivos autorizados foram guardados em 'dispositivos.json'.")

if __name__ == "__main__":
    main()
