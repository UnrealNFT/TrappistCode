# pyright: reportMissingImports=false
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELE_CERVEAU = "hf.co/mradermacher/DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic-i1-GGUF:Q4_K_M"
MODELE_RELECTEUR = "huihui_ai/qwen3-abliterated:8b"

class AskRequest(BaseModel):
    question: str
    system: str = ""
    file_content: str = ""
    file_path: str = ""

@app.post("/ask")
async def ask(req: AskRequest):
    system = req.system or "You are a precise coding assistant in TrappistCode."

    file_context = ""
    if req.file_path and req.file_content:
        content = req.file_content
        if len(content) > 5000:
            file_context = f"\n\nFichier : {req.file_path} (extrait)\n```\n{content[:3500]}\n```"
        else:
            file_context = f"\n\nFichier ouvert : {req.file_path}\n```\n{content}\n```"

    strict = """
RÈGLES STRICTES :
- Fais des modifications très ciblées.
- Utilise un bloc ```edit_buffer avec le texte EXACT à remplacer.
- Ne réécris pas tout le fichier.
- Réponds en français.
- Si tu veux modifier, tu DOIS utiliser le format edit_buffer.
"""

    messages = [
        {"role": "system", "content": system + file_context + strict},
        {"role": "user", "content": req.question}
    ]

    max_loops = 4
    final_answer = ""
    reasoning = ""
    loops_done = 0

    for i in range(max_loops):
        loops_done = i + 1

        # --- Cerveau ---
        brain = ollama.chat(
            model=MODELE_CERVEAU,
            messages=messages,
            options={"num_ctx": 8192, "temperature": 0.25}
        )
        reasoning = brain["message"]["content"]

        # --- Relecteur ---
        review_prompt = f"""Question : {req.question}

Réponse du cerveau :
{reasoning}

---
Ton rôle :
1. Vérifie si la réponse contient un bloc edit_buffer ou set_buffer correct.
2. Si oui → améliore légèrement et renvoie la version finale.
3. Si non → explique clairement ce qui manque et demande une correction précise.
Réponds en français."""

        review = ollama.chat(
            model=MODELE_RELECTEUR,
            messages=[
                {"role": "system", "content": "Tu es un relecteur strict. Tu vérifies les modifications de code et tu forces le bon format."},
                {"role": "user", "content": review_prompt}
            ],
            options={"num_ctx": 8192, "temperature": 0.2}
        )
        final_answer = review["message"]["content"]

        # Si on a un vrai bloc de modification, on arrête
        if "```edit_buffer" in final_answer or "```set_buffer" in final_answer:
            break

        # Sinon on renvoie au cerveau avec le feedback
        messages.append({"role": "assistant", "content": reasoning})
        messages.append({
            "role": "user",
            "content": f"Feedback du relecteur :\n{final_answer}\n\nCorrige et renvoie un vrai bloc edit_buffer avec le texte exact."
        })

    return {
        "reasoning": reasoning,
        "final": final_answer,
        "loops": loops_done
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)