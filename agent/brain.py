"""Cerveau de l'agent : LLM local (Ollama) qui produit des actions JSON."""
import json, re
import ollama

MODELE_CERVEAU = "hf.co/mradermacher/DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic-i1-GGUF:Q4_K_M"
MODELE_RELECTEUR = "huihui_ai/qwen3-abliterated:8b"

SYSTEM = """Tu es un agent de code autonome (TrappistCode). Tu agis sur un vrai projet.

A chaque tour tu DOIS repondre par UN SEUL objet JSON (rien d'autre) :
{
  "pensee": "ton raisonnement court",
  "action": "read_file|write_file|delete_file|list_files|shell|git|commit_push|trappist_generate|plan|done",
  "args": { ... },
  "message_commit": "si commit_push"
}

Actions :
- write_file   args={"path","content"}  -> cree/ecrase un fichier
- read_file    args={"path"}
- delete_file  args={"path"}
- list_files   args={}
- shell        args={"cmd"}               -> npm, tests, build...
- git          args={"args"}              -> ex: \"status\", \"diff\"
- commit_push  args={"message"}          -> commit + push sur GitHub
- trappist_generate args={"kind","prompt","out_path"} -> image|music|3d|video
- plan         args={"etapes":["..."]}    -> pose ton plan au debut
- done         args={"resume"}            -> objectif atteint

Regles :
- Petites etapes. Un seul outil par tour.
- Verifie avec shell (tests/build) avant de commit.
- Commit regulierement avec des messages clairs en francais.
- JSON strict, aucun texte hors du JSON."""


def extraire_json(texte: str) -> dict:
    m = re.search(r"\{.*\}", texte, re.DOTALL)
    if not m:
        return {"action": "plan", "args": {"etapes": [texte[:300]]}, "pensee": "fallback"}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return {"action": "plan", "args": {"etapes": ["JSON invalide, replanifier"]}, "pensee": "erreur"}


def decider(objectif: str, historique: list, contexte: str) -> dict:
    """Un tour de decision. historique = liste de (action, resultat)."""
    hist = "\n".join(f"- {a} => {str(r)[:400]}" for a, r in historique[-10:]) or "(debut)"
    prompt = (
        f"OBJECTIF : {objectif}\n\n"
        f"CONTEXTE PROJET :\n{contexte[:2500]}\n\n"
        f"HISTORIQUE RECENT :\n{hist}\n\n"
        f"Quelle est la prochaine action ? JSON uniquement."
    )
    r = ollama.chat(
        model=MODELE_CERVEAU,
        messages=[{"role": "system", "content": SYSTEM},
                  {"role": "user", "content": prompt}],
        options={"num_ctx": 8192, "temperature": 0.3},
    )
    return extraire_json(r["message"]["content"])


def verifier(objectif: str, action: dict, resultat: str) -> str:
    """Le relecteur critique le resultat d'une action (pour la memoire de l'agent)."""
    prompt = (
        f"Objectif : {objectif}\nAction : {action}\nResultat : {resultat[:1200]}\n\n"
        f"En 2-3 phrases : l'action a-t-elle avance l'objectif ? Erreur a corriger ? Reponds en francais."
    )
    r = ollama.chat(
        model=MODELE_RELECTEUR,
        messages=[{"role": "system", "content": "Tu es un relecteur critique et concis."},
                  {"role": "user", "content": prompt}],
        options={"num_ctx": 4096, "temperature": 0.2},
    )
    return r["message"]["content"]
