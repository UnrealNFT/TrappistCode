import { useState } from 'react'
import axios from 'axios'
import {
  createFile,
  parseRepoFullName,
  listFiles,
  readFile
} from '../services/github'

interface ChatProps {
  selectedAgent: 'groq' | 'kimi' | 'claude' | 'kimi-wavespeed'
  githubToken?: string
  isTokenValid?: boolean
  selectedRepo?: string | null
}

const MAX_HISTORY = 12
const MAX_CONTENT_CHARS = 4000

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content
  return (
    content.slice(0, MAX_CONTENT_CHARS) +
    '\n\n…[contenu tronqué pour limiter la taille de la requête]'
  )
}

function extractResponseText(message: any): string {
  const content = message?.content?.trim?.() || ''
  const reasoning = message?.reasoning_content?.trim?.() || ''
  return content || reasoning || '(réponse vide)'
}

function Chat({
  selectedAgent,
  githubToken = '',
  isTokenValid = false,
  selectedRepo = null
}: ChatProps) {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const extractGitHubAction = (text: string) => {
    // Accepte ```github-action puis JSON (même sur la même ligne)
    const match = text.match(/```github-action\s*([\s\S]*?)```/)
    if (!match) {
      console.warn('[github-action] aucun bloc trouvé')
      return null
    }

   const raw = match[1].trim()
    try {
      const parsed = JSON.parse(raw)
      console.log('[github-action] OK', parsed?.action, parsed?.path)
      return parsed
    } catch (err) {
      console.error('[github-action] JSON invalide', err)
      console.error('[github-action] raw=', raw.slice(0, 400))
      return { __parseError: true, raw: raw.slice(0, 200) }
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
      content:
        isTokenValid && selectedRepo
          ? `Tu es un assistant de code dans TrappistCode.
Repo actif : ${selectedRepo}
Token GitHub : connecté (fourni par l'utilisateur, déjà authentifié).

Tu as 3 actions. Quand tu en as besoin, termine ta réponse avec UN seul bloc :

\`\`\`github-action
{ ... }
\`\`\`

1) Lister un dossier ("" = racine) :
{"action":"list_files","path":""}

2) Lire un fichier :
{"action":"read_file","path":"index.html"}

3) Créer ou mettre à jour un fichier :
{"action":"create_file","path":"README.md","content":"...","message":"Add README.md"}

Règles STRICTES :
- Ne devine pas le contenu des fichiers : utilise list_files ou read_file
- Ne simule pas git/bash / commit / push
- N'affirme JAMAIS qu'un fichier a été créé ou poussé : c'est l'application qui le fait après ton bloc
- create_file : contenu max ~3000 caractères. Fichiers plus gros = refuse et propose une version courte
- path peut être un sous-dossier (ex: src/app.js)
- Si aucune action n'est nécessaire, réponds normalement SANS bloc`
          : isTokenValid
            ? `Tu es un assistant dans TrappistCode. Token GitHub connecté mais aucun repo sélectionné. Demande à l'utilisateur de choisir un repo.`
            : `Tu es un assistant dans TrappistCode. Aucun token GitHub connecté.`
    }

    const recent = updatedMessages.slice(-MAX_HISTORY).map((m) => ({
      role: m.role,
      content: truncateContent(m.content)
    }))

    const messagesForApi = [systemMessage, ...recent]

    // --- Appel LLM ---
    if (selectedAgent === 'groq') {
      try {
        const groqRes = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.1-8b-instant',
            messages: messagesForApi,
            max_tokens: 2048
          },
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        )
        responseContent = extractResponseText(groqRes.data.choices?.[0]?.message)
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 413) {
          responseContent =
            '❌ Historique trop long (413). Clique sur "Vider le chat" ou envoie un message plus court.'
        } else if (status === 401) {
          responseContent = '❌ Clé Groq invalide (401)'
        } else if (e?.code === 'ECONNABORTED') {
          responseContent = '❌ Timeout Groq'
        } else {
          console.error(e)
          responseContent = 'Erreur Groq'
        }
      }
    } else {
      const modelMap: Record<string, string> = {
        kimi: 'moonshotai/kimi-k3',
        'kimi-wavespeed': 'moonshotai/kimi-k3',
        claude: 'anthropic/claude-sonnet-4.5'
      }
      const model = modelMap[selectedAgent] ?? 'deepseek/deepseek-v4-flash'

      try {
        const res = await axios.post(
          '/api/wavespeed/chat/completions',
          {
            model,
            messages: messagesForApi,
            max_tokens: 2048
          },
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_WAVESPEED_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 180000
          }
        )
        responseContent = extractResponseText(res.data.choices?.[0]?.message)
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 401) {
          responseContent = '❌ Clé WaveSpeed invalide (401)'
        } else if (status === 413) {
          responseContent =
            '❌ Historique trop long (413). Videz le chat ou raccourcissez le message.'
        } else if (e?.code === 'ECONNABORTED' || status === 504) {
          responseContent = `❌ Timeout ${selectedAgent}`
        } else if (
          e?.message?.includes('Network') ||
          e?.message?.includes('CORS') ||
          e?.code === 'ERR_NETWORK'
        ) {
          responseContent =
            '❌ CORS / réseau WaveSpeed. Vérifie la clé ou réessaie.'
        } else {
          console.error(e)
          responseContent = 'Erreur ' + selectedAgent
        }
      }
    }

    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: responseContent }
    ])

    // --- Exécution GitHub ---
    const action = extractGitHubAction(responseContent)

    if (action?.__parseError) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '❌ Action GitHub invalide : JSON tronqué ou mal formé.\n' +
            'Demande un fichier plus petit (ex: README court).'
        }
      ])
      setLoading(false)
      return
    }

    if (action && isTokenValid && selectedRepo && githubToken) {
      try {
        const { owner, repo } = parseRepoFullName(selectedRepo)

        if (action.action === 'list_files') {
          const files = await listFiles({
            token: githubToken,
            owner,
            repo,
            path: action.path || ''
          })
          const listing = files
            .map((f) => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`)
            .join('\n')

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `📂 Contenu de ${action.path || '/'} :\n\n${listing || '(vide)'}`
            }
          ])
        }

        if (action.action === 'read_file') {
          if (!action.path) throw new Error('path manquant pour read_file')

          const file = await readFile({
            token: githubToken,
            owner,
            repo,
            path: action.path
          })

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `📄 ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\``
            }
          ])
        }

        if (action.action === 'create_file') {
          if (!action.path || typeof action.content !== 'string') {
            throw new Error('create_file incomplet (path ou content manquant)')
          }

          console.log(
            '[create_file]',
            selectedRepo,
            action.path,
            'chars=',
            action.content.length
          )

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
              content:
                `✅ Fichier **${action.path}** créé/mis à jour sur GitHub.\n` +
                `https://github.com/${selectedRepo}/blob/main/${action.path}`
            }
          ])
        }
      } catch (e: any) {
        const status = e?.response?.status
        const errMsg =
          e?.response?.data?.message || e?.message || 'Erreur inconnue'
        console.error('[github] erreur', status, errMsg, e)
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `❌ Erreur GitHub (${status || '?'}) : ${errMsg}`
          }
        ])
      }
    } else if (action && !isTokenValid) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '❌ Token GitHub invalide ou manquant.'
        }
      ])
    } else if (action && !selectedRepo) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '❌ Aucun repo sélectionné.'
        }
      ])
    }

    setLoading(false)
  }

  const clearChat = () => {
    setMessages([])
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

        <button
          onClick={clearChat}
          style={{
            marginLeft: '12px',
            background: 'transparent',
            border: '1px solid #3e3e42',
            color: '#cccccc',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Vider le chat
        </button>

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
          <div
            style={{ textAlign: 'center', color: '#666', marginTop: '80px' }}
          >
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
              backgroundColor: msg.role === 'user' ? '#094771' : '#252526',
              color: '#cccccc',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {msg.content || '(message vide)'}
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
            placeholder="Ex: lis les fichiers · lis index.html · crée un README"
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