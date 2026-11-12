"""Boucle autonome : planifier -> agir -> observer -> recommencer."""
import json, os, time
from . import brain, tools

LOG_DIR = os.path.join(tools.ROOT, ".agent")


def _log(entry: dict):
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(os.path.join(LOG_DIR, "journal.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def executer(action: dict) -> str:
    """Execute une action via tools.TOOLS. Renvoie le resultat texte."""
    nom = action.get("action", "")
    args = action.get("args", {}) or {}
    if nom == "commit_push":
        return tools.commit_push(action.get("message_commit") or args.get("message", "agent: avancement"))
    fn = tools.TOOLS.get(nom)
    if not fn:
        return f"Action inconnue: {nom}"
    try:
        return str(fn(**args))
    except TypeError as e:
        return f"Args invalides pour {nom}: {e}"
    except Exception as e:
        return f"Erreur {nom}: {e}"


def boucle(objectif: str, max_tours: int = 40, commit_chaque: int = 5, callback=None):
    """Boucle agentique principale. callback(tour, action, resultat) optionnel (UI/log)."""
    historique = []
    tours_sans_commit = 0
    for tour in range(1, max_tours + 1):
        contexte = tools.list_files()
        action = brain.decider(objectif, historique, contexte)
        nom = action.get("action", "?")

        if nom == "done":
            resume = action.get("args", {}).get("resume", "termine")
            _log({"tour": tour, "done": resume})
            if callback:
                callback(tour, action, resume)
            return resume

        resultat = executer(action)
        critique = brain.verifier(objectif, action, resultat)
        historique.append((f"{nom} {action.get('args', {})}", resultat[:400] + " | " + critique[:200]))
        _log({"tour": tour, "action": action, "resultat": resultat[:2000], "critique": critique})

        if callback:
            callback(tour, action, resultat)

        tours_sans_commit += 1
        if nom in ("write_file", "trappist_generate") and tours_sans_commit >= commit_chaque:
            msg = f"agent: avancement auto (tour {tour})"
            historique.append(("commit_push auto", tools.commit_push(msg)[:200]))
            tours_sans_commit = 0

        time.sleep(1)  # menage les modeles locaux

    return f"Max tours atteint ({max_tours}). Relancer pour continuer."


if __name__ == "__main__":
    import sys
    obj = sys.argv[1] if len(sys.argv) > 1 else input("Objectif : ")

    def console(t, a, r):
        print(f"\n--- Tour {t} : {a.get('action')} ---")
        print(str(r)[:600])

    print(boucle(obj, callback=console))
