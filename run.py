import os
import sys
import subprocess
import socket


def get_lan_ip():
    """현재 활성화된 네트워크 인터페이스의 실제 로컬 LAN IP를 가져옵니다."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def clear_port(port):
    """8000번 포트를 리스닝 중인 프로세스를 안전하고 정확하게 종료합니다."""
    try:
        current_pid = os.getpid()
        if sys.platform == "win32":
            # 윈도우 netstat 출력에서 정확히 로컬 포트가 :{port} 인 LISTENING 프로세스만 필터링
            output = subprocess.check_output(
                "netstat -ano -p tcp", shell=True
            ).decode("cp949", errors="ignore")
            for line in output.strip().splitlines():
                parts = line.strip().split()
                # 프로토콜 로컬주소 외부주소 상태 PID (최소 5개 컬럼)
                if len(parts) >= 5 and parts[3] == "LISTENING":
                    local_addr = parts[1]
                    # 로컬 주소가 정확히 :{port}로 끝나는지 검증
                    if local_addr.endswith(f":{port}"):
                        pid_str = parts[4]
                        if pid_str.isdigit():
                            pid = int(pid_str)
                            if pid != current_pid and pid > 0:
                                print(
                                    f"🧹 [PORT CLEAR] 포트 {port}를 점유 중인 기존 프로세스(PID: {pid}) 정리 중..."
                                )
                                subprocess.run(
                                    ["taskkill", "/F", "/PID", str(pid)],
                                    stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL,
                                )
    except Exception:
        pass


def start_engine():
    port = 8000
    clear_port(port)
    lan_ip = get_lan_ip()

    print("\n" + "=" * 50)
    print("      🚀 SELLNANCE ENGINE v1.2 - BOOTING...")
    print("=" * 50)
    print(f"📂 [PATH] {os.getcwd()}")
    print(f"🌐 [HOST] http://127.0.0.1:{port}  |  📱 [LAN] http://{lan_ip}:{port}")
    print("-" * 50)

    # Uvicorn 가동 (modules/app.py의 app 객체 실행)
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "modules.app:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(port),
        "--log-level",
        "info",
        "--reload",
    ]

    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\n\n👋 [STOP] 엔진 가동이 중단되었습니다.")


if __name__ == "__main__":
    start_engine()
