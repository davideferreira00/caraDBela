import subprocess
import socket
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_local_ip():
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        if local_ip.startswith("127."):
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        return local_ip
    except:
        return None

def ping(ip):
    # No Windows, -n 1 para 1 pacote e -w 1000 para timeout 1000 ms
    try:
        resultado = subprocess.run(
            ["ping", "-n", "1", "-w", "1000", ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return (ip, resultado.returncode == 0)
    except Exception:
        return (ip, False)

def get_mac(ip):
    try:
        resultado = subprocess.run(["arp", "-a", ip], capture_output=True, text=True)
        linhas = resultado.stdout.splitlines()
        for linha in linhas:
            if ip in linha:
                partes = linha.split()
                for parte in partes:
                    if "-" in parte and len(parte) == 17:
                        return parte
    except Exception:
        pass
    return None

def get_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except:
        return "Desconhecido"

def main():
    ip_local = get_local_ip()
    if not ip_local:
        print("Não foi possível detectar o IP local.")
        return

    print(f"IP local detetado: {ip_local}")
    prefixo = ".".join(ip_local.split(".")[:3])

    print("A procurar dispositivos na rede...")

    ativos = []
    with ThreadPoolExecutor(max_workers=50) as executor:
        futuros = {executor.submit(ping, f"{prefixo}.{i}"): i for i in range(1, 255)}
        for futuro in as_completed(futuros):
            ip, ativo = futuro.result()
            if ativo:
                ativos.append(ip)

    dispositivos = {}
    for ip in ativos:
        mac = get_mac(ip)
        if mac:
            nome_dns = get_hostname(ip)
            print(f"IP: {ip} - MAC: {mac} - Nome: {nome_dns}")
            resposta = input("Deseja adicionar este dispositivo à rede (sim/não)? ").strip().lower()
            if resposta in ["sim", "s"]:
                nome = input(f"Nome para o dispositivo [{nome_dns}]: ").strip()
                if nome == "":
                    nome = nome_dns
                dispositivos[nome] = {"IP": ip, "MAC": mac}
                print(f"{ip} - {mac} foi adicionado como '{nome}'.")
            else:
                print(f"{ip} - {mac} não foi adicionado.")

    with open("dispositivos.json", "w", encoding="utf-8") as f:
        json.dump(dispositivos, f, indent=4)
    print("Dispositivos foram salvos em dispositivos.json.")

if __name__ == "__main__":
    main()
