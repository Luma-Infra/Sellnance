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
    """8000번 포트를 점유 중인 프로세스를 찾아 강제로 종료합니다."""
    try:
        # 윈도우 netstat 명령어로 PID 찾기
        result = subprocess.check_output(
            f"netstat -aon | findstr :{port}", shell=True
        ).decode("cp949")
        for line in result.strip().split("\n"):
            if "LISTENING" in line:
                pid = line.strip().split()[-1]
                print(
                    f"🧹 [PORT CLEAR] 포트 {port}를 점유 중인 프로세스({pid}) 종료 중..."
                )
                os.system(f"taskkill /f /pid {pid}")
    except:
        # 포트가 비어있으면 에러 무시
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
