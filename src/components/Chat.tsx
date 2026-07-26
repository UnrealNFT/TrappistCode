import { useState } from 'react'
import axios from 'axios'
import { createFile, parseRepoFullName } from '../services/github'

interface ChatProps {
  selectedAgent: 'groq' | 'kimi' | 'claude'
  githubToken?: string
  isTokenValid?: boolean
  selectedRepo?: string | null
}

function Chat({
  selectedAgent,
  githubToken = '',
  isTokenValid = false,
  selectedRepo = null
}: ChatProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Détecte un bloc d'action GitHub dans la réponse de l'agent
  const extractGitHubAction = (text: string) => {
    const match = text.match(/```github-action\s*([\s\S]*?)```/)
    if (!match) return null
    try {
      return JSON.parse(match[1].trim())
    } catch {
      return null
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    let responseContent = ''

    const systemMessage = {
      role: 'system',
      content: isTokenValid && selectedRepo
        ? `Tu es un assistant de code dans TrappistCode.
Repo actif : ${selectedRepo}
Token GitHub : connecté

Quand l'utilisateur te demande de CRÉER un fichier (html, js, py, md, css, etc.), tu dois :
1. Écrire une courte explication
2. Ensuite obligatoirement un bloc exactement comme ceci :

\`\`\`github-action
{
  "action": "create_file",
  "path": "nom-du-fichier.ext",
  "content": "contenu complet du fichier ici",
  "message": "Add nom-du-fichier.ext"
}
\`\`\`

Règles :
- path = chemin du fichier (ex: index.html ou src/app.js)
- content = le contenu COMPLET du fichier
- message = message de commit
- Tu peux créer n'importe quel type de fichier
- Ne simule PAS git/bash. Utilise uniquement ce bloc github-action.
- Si l'utilisateur ne demande pas de créer un fichier, réponds normalement sans ce bloc.`
        : isTokenValid
          ? `Tu es un assistant dans TrappistCode. Token GitHub connecté mais aucun repo sélectionné. Demande à l'utilisateur de choisir un repo.`
          : `Tu es un assistant dans TrappistCode. Aucun token GitHub connecté.`
    }

    const messagesForApi = [systemMessage, ...updatedMessages]

    // --- Appel LLM ---
    if (selectedAgent === 'groq') {
      try {
        const groqRes = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.1-8b-instant',
            messages: messagesForApi
          },
          {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_KEY}` }
          }
        )
        responseContent = groqRes.data.choices[0].message.content
      } catch {
        responseContent = 'Erreur Groq'
      }
    } else {
      const model =
        selectedAgent === 'kimi'
          ? 'moonshotai/kimi-k3'
          : 'anthropic/claude-sonnet-4.5'
      try {
        const res = await axios.post(
          '/wavespeed/v1/chat/completions',
          { model, messages: messagesForApi },
          {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_WAVESPEED_KEY}` },
            timeout: 600000
          }
        )
        responseContent = res.data.choices[0].message.content
      } catch {
        responseContent = 'Erreur ' + selectedAgent
      }
    }

    // Affiche d'abord la réponse de l'agent
    setMessages((prev) => [...prev, { role: 'assistant', content: responseContent }])

    // --- Exécution réelle sur GitHub ---
    const action = extractGitHubAction(responseContent)

    if (
      action &&
      action.action === 'create_file' &&
      isTokenValid &&
      selectedRepo &&
      githubToken
    ) {
      try {
        const { owner, repo } = parseRepoFullName(selectedRepo)

        await createFile({
          token: githubToken,
          owner,
          repo,
          path: action.path,
          content: action.content,
          message: action.message || `Add ${action.path}`
        })

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ Fichier **${action.path}** créé et pushé sur GitHub.\nRepo : ${selectedRepo}\nVérifie ici : https://github.com/${selectedRepo}`
          }
        ])
      } catch (e: any) {
        const errMsg =
          e?.response?.data?.message || e?.message || 'Erreur inconnue'
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `❌ Erreur GitHub : ${errMsg}`
          }
        ])
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Tab Bar */}
      <div
        style={{
          height: '35px',
          backgroundColor: '#1e1e1e',
          borderBottom: '1px solid #3e3e42',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px'
        }}
      >
        <div
          style={{
            padding: '0 16px',
            borderTop: '2px solid #007acc',
            backgroundColor: '#1e1e1e'
          }}
        >
          chat.tsx
        </div>
        {isTokenValid && (
          <div
            style={{
              marginLeft: 'auto',
              paddingRight: '16px',
              fontSize: '11px',
              color: '#4ec9b0'
            }}
          >
            GitHub OK {selectedRepo ? `· ${selectedRepo}` : ''}
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '80px' }}>
            Commence à parler...
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              maxWidth: '90%',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: msg.role === 'user' ? '#094771' : '#1e1e1e'
            }}
          >
            {msg.role === 'assistant' ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content.split('```').map((part, i) => {
                  if (i % 2 === 1) {
                    return (
                      <pre
                        key={i}
                        style={{
                          backgroundColor: '#0d1117',
                          padding: '20px',
                          borderRadius: '6px',
                          fontFamily: 'Consolas, monospace',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          color: '#c9d1d9',
                          overflowX: 'auto',
                          margin: '12px 0'
                        }}
                      >
                        {part}
                      </pre>
                    )
                  }
                  return (
                    <div key={i} style={{ marginBottom: '12px' }}>
                      {part}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ color: '#666' }}>Agent réfléchit...</div>}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #3e3e42',
          backgroundColor: '#252526'
        }}
      >
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ex: crée index.html fond noir bouton vert"
            style={{
              flex: 1,
              backgroundColor: '#3c3c3c',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              padding: '12px',
              color: '#cccccc',
              outline: 'none'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              backgroundColor: '#007acc',
              color: 'white',
              padding: '0 32px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

export default Chat