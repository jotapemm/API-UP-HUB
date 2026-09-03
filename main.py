import json
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    cfg = json.loads((Path(__file__).parent / "config.json").read_text(encoding="utf-8"))
    porta = cfg.get("porta:", 8090)
    print(f"UP API HUB -> http://localhost:{porta}")
    uvicorn.run("src.web.app:app", host="0.0.0.0", port=porta, log_level="warning")