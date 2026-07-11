import socket
import requests
from typing import Optional

def check_service_status(host: str, port: int, endpoint: Optional[str] = None, timeout: int = 5) -> bool:
    """
    Verifica si un servicio está levantado.

    Args:
        host: IP o dominio del servicio.
        port: Puerto del servicio.
        endpoint: Ruta HTTP específica (ej. '/health', '/v1/models').
                  Si es None, solo hace ping TCP.
        timeout: Tiempo máximo de espera en segundos.

    Returns:
        True si el servicio responde, False en caso contrario.
    """
    # 1. Comprobación de nivel de red (TCP)
    # Funciona para cualquier servicio que escuche en un puerto (DB, API, Cache)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            result = s.connect_ex((host, port))
            if result != 0:
                return False # El puerto no está abierto
    except Exception:
        return False

    # 2. Comprobación de nivel de aplicación (HTTP)
    # Solo si se proporciona un endpoint y el servicio es HTTP
    if endpoint:
        try:
            url = f"http://{host}:{port}{endpoint}"
            response = requests.get(url, timeout=timeout)
            # Consideramos 'levantado' si responde 2xx o 3xx
            return 200 <= response.status_code < 400
        except requests.exceptions.RequestException:
            return False

    return True

# Ejemplos de uso:

# Caso A: Solo saber si el puerto está abierto (Genérico para vLLM, FastAPI, Redis, etc.)
is_up_tcp = check_service_status("192.168.57.68", 8014)
print(f"Servicio en puerto 8000 (TCP): {'LEVANTADO' if is_up_tcp else 'CAÍDO'}")
