"""Outils de l'agent TrappistCode : fichiers, shell, git, TrappistAI."""
import os, json, subprocess, urllib.request

ROOT = os.path.abspath(os.environ.get("AGENT_ROOT", os.getcwd()))

def _safe(path: str) -> str:
    p = os.path.abspath(os.path.join(ROOT, path))
    if not p.startswith(ROOT):
        raise ValueError(f"Chemin hors projet: {path}")
    return p

def read_file(path: str) -> str:
    with open(_safe(path), encoding="utf-8") as f:
        return f.read()

def write_file(path: str, content: str) -> str:
    p = _safe(path)
    d = os.path.dirname(p)
    if d:
        os.makedirs(d, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    return f"OK {path} ({len(content)} car.)"

def delete_file(path: str) -> str:
    os.remove(_safe(path))
    return f"Supprime: {path}"

def list_files() -> str:
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in (".git", "node_modules", "__pycache__", "dist")]
        for f in fn:
            out.append(os.path.relpath(os.path.join(dp, f), ROOT))
    return "\n".join(sorted(out)[:400])

def shell(cmd: str, timeout: int = 180) -> str:
    try:
        r = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return ((r.stdout or "") + (r.stderr or "")).strip()[:3000] or "(rien)"
    except subprocess.TimeoutExpired:
        return f"TIMEOUT ({timeout}s): {cmd}"

def git(args: str) -> str:
    return shell("git " + args)

def commit_push(message: str) -> str:
    git("add -A")
    git("commit -m " + json.dumps(message))
    return git("push")

def trappist_generate(kind: str, prompt: str, out_path: str) -> str:
    """Genere un asset via TrappistAI : kind = image | music | 3d | video."""
    url = os.environ.get("TRAPPIST_API", "http://localhost:9000/generate")
    body = json.dumps({"kind": kind, "prompt": prompt}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = resp.read()
    p = _safe(out_path)
    d = os.path.dirname(p)
    if d:
        os.makedirs(d, exist_ok=True)
    with open(p, "wb") as f:
        f.write(data)
    return f"Asset {kind} -> {out_path} ({len(data)} octets)"

TOOLS = {
    "read_file": read_file,
    "write_file": write_file,
    "delete_file": delete_file,
    "list_files": list_files,
    "shell": shell,
    "git": git,
    "commit_push": commit_push,
    "trappist_generate": trappist_generate,
}
