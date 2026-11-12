"""Daemon TrappistCode : tourne en continu, traite les objectifs en file.

Usage :
    python -m agent.daemon          # lance le daemon

Pendant qu'il tourne :
    echo "Cree une appli de map spatiale" >> tasks.txt
    echo "STOP" > .agent/STOP        # arret propre
"""
import os, time, traceback
from . import tools, loop

TASKS_FILE = os.path.join(tools.ROOT, "tasks.txt")
DONE_FILE = os.path.join(tools.ROOT, ".agent", "tasks_done.txt")
STOP_FILE = os.path.join(tools.ROOT, ".agent", "STOP")
PAUSE = 30  # secondes entre deux verifications de la file


def _marque_stop() -> bool:
    return os.path.exists(STOP_FILE)


def prochaine_tache() -> str:
    if not os.path.exists(TASKS_FILE):
        return ""
    with open(TASKS_FILE, encoding="utf-8") as f:
        lignes = [l.strip() for l in f if l.strip()]
    if not lignes:
        return ""
    tache, reste = lignes[0], lignes[1:]
    with open(TASKS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(reste) + ("\n" if reste else ""))
    os.makedirs(os.path.dirname(DONE_FILE), exist_ok=True)
    with open(DONE_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M')}] {tache}\n")
    return tache


def run():
    print("Daemon TrappistCode demarre. Ajoute des objectifs dans tasks.txt")
    os.makedirs(os.path.join(tools.ROOT, ".agent"), exist_ok=True)
    if os.path.exists(STOP_FILE):
        os.remove(STOP_FILE)

    while not _marque_stop():
        tache = prochaine_tache()
        if not tache:
            time.sleep(PAUSE)
            continue

        print(f"\n=== Nouvel objectif : {tache} ===")
        try:
            resume = loop.boucle(
                tache,
                max_tours=60,
                commit_chaque=5,
                callback=lambda t, a, r: print(f"[tour {t}] {a.get('action')}: {str(r)[:200]}"),
            )
            tools.commit_push(f"agent: objectif termine - {tache[:60]}\n\n{resume[:300]}")
            print(f"=== Termine : {resume[:200]} ===")
        except Exception:
            traceback.print_exc()
            tools.commit_push(f"agent: erreur sur objectif - {tache[:60]}")
        time.sleep(5)

    print("Daemon arrete proprement.")


if __name__ == "__main__":
    run()
