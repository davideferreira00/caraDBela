import subprocess
import socket
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import platform
import re
import netifaces
import sys
import os

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None

def get_ssid():
    try:
        system = platform.system()
        if system == 'Windows':
            result = subprocess.check_output(['netsh', 'wlan', 'show', 'interfaces'], text=True, stderr=subprocess.DEVNULL)
            match = re.search(r'SSID\s*:\s*(.*)', result)
            if match:
                return match.group(1).strip()
        
        elif system == 'Darwin':
            result = subprocess.check_output(['/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport', '-I'], text=True, stderr=subprocess.DEVNULL)
            match = re.search(r'SSID:\s*(.*)', result)
            if match:
                return match.group(1).strip()
        
        else:
            try:
                result = subprocess.check_output(['iwgetid', '-r'], text=True, stderr=subprocess.DEVNULL)
                if result:
                    return result.strip()
            except:
                pass

            try:
                result = subprocess.check_output(['nmcli', '-t', '-f', 'active,ssid', 'dev', 'wifi'], text=True, stderr=subprocess.DEVNULL)
                for line in result.splitlines():
                    if line.startswith('yes:'):
                        return line.split(':', 1)[1]
            except:
                pass
    
    except Exception as e:
        print(f"Erro ao obter SSID: {str(e)}", file=sys.stderr)
    
    return "Rede Desconhecida"

def ping(ip):
    try:
        param = "-n" if platform.system().lower() == "windows" else "-c"
        timeout_param = "-w" if platform.system().lower() == "windows" else "-W"
        
        command = [
            "ping", 
            param, "1", 
            timeout_param, "500",
            ip
        ]
        
        resultado = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=1
        )
        return ip if resultado.returncode == 0 else None
    except Exception:
        return None

def get_mac(ip):
    try:
        if platform.system() == 'Windows':
            result = subprocess.check_output(['getmac', '/NH', '/FO', 'CSV'], text=True, stderr=subprocess.DEVNULL)
            for line in result.splitlines():
                if ip in line:
                    parts = line.split(',')
                    if len(parts) > 0:
                        return parts[0].strip('"').replace('-', ':').upper()
        
        elif platform.system() in ['Linux', 'Darwin']:
            import fcntl
            import struct
            
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            info = fcntl.ioctl(
                s.fileno(),
                0x8927,
                struct.pack('256s', bytes(ip[:15], 'utf-8'))
            )
            return ':'.join(f'{b:02x}' for b in info[18:24]).upper()
    
    except Exception:
        pass
    
    try:
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr in addrs[netifaces.AF_INET]:
                    if addr['addr'] == ip and netifaces.AF_LINK in addrs:
                        return addrs[netifaces.AF_LINK][0]['addr'].upper()
    except Exception:
        pass
    
    return "Desconhecido"

def get_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:
        return "Desconhecido"

def main():
    try:
        ip_local = get_local_ip()
        if not ip_local:
            return json.dumps({"erro": "Não foi possível obter o IP local."})
        
        prefixo = ".".join(ip_local.split(".")[:3])
        ssid = get_ssid()
        
        ativos = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            futuros = [executor.submit(ping, f"{prefixo}.{i}") for i in range(1, 255)]
            for futuro in as_completed(futuros):
                ip = futuro.result()
                if ip:
                    ativos.append(ip)
        
        dispositivos = []
        for ip in ativos:
            mac = get_mac(ip)
            hostname = get_hostname(ip)
            nome = hostname if hostname != "Desconhecido" else ip
            dispositivos.append({
                "ip": ip, 
                "mac": mac, 
                "name": nome,
                "ssid": ssid
            })
        
        return json.dumps(dispositivos)
    
    except Exception as e:
        return json.dumps({"erro": f"Erro fatal no scanner: {str(e)}"})

if __name__ == "__main__":
    print(main())
