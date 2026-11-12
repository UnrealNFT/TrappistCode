import { useState } from 'react'
import axios from 'axios'
import {
  createFile,
  parseRepoFullName,
  listFiles,
  readFile,
  patchFile,
} from '../services/github'

interface ChatProps {
  selectedAgent: 'groq' | 'kimi' | 'claude' | 'kimi-wavespeed' | 'trappist-local'
  githubToken?: string
  isTokenValid?: boolean
  selectedRepo?: string | null
  openPath?: string | null
  fileContent?: string
  onApplyEdit?: (content: string) => void
}

const MAX_HISTORY = 12
const MAX_CONTENT_CHARS = 4000
const MAX_AUTO_STEPS = 20
const BUFFER_PREVIEW = 6000

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

function displayContent(text: string): string {
  return text
    .replace(/```github-action\s*[\s\S]*?```/g, '⟦action exécutée⟧')
    .replace(/```edit_buffer\s*[\s\S]*?```/g, '⟦modif appliquée⟧')
    .replace(/```set_buffer\s*[\s\S]*?```/g, '⟦fichier remplacé⟧')
    .trim()
}

function Chat({
  selectedAgent,
  githubToken = '',
  isTokenValid = false,
  selectedRepo = null,
  openPath = null,
  fileContent = '',
  onApplyEdit,
}: ChatProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [autonomous, setAutonomous] = useState(false)

  const extractAction = (text: string) => {
    const match = text.match(/```github-action\s*([\s\S]*?)```/)
    if (!match) return null
    const raw = match[1].trim()
    try {
      return JSON.parse(raw)
    } catch {
      return { __parseError: true as const, raw: raw.slice(0, 200) }
    }
  }

  const buildSystemPrompt = () => {
    const bufferInfo =
      openPath && fileContent !== undefined
        ? `\nFichier OUVERT dans l'éditeur : ${openPath}\nContenu actuel (peut être tronqué) :\n\`\`\`\n${fileContent.slice(0, BUFFER_PREVIEW)}${fileContent.length > BUFFER_PREVIEW ? '\n…[tronqué]' : ''}\n\`\`\`\n\nActions LOCALES (prioritaires — modifient l'éditeur, PAS GitHub) :\n\n5) edit_buffer — remplace un morceau exact dans l'éditeur :\n{"action":"edit_buffer","oldText":"texte exact","newText":"nouveau"}\n\n6) set_buffer — remplace tout le contenu de l'éditeur :\n{"action":"set_buffer","content":"..."}\n\nRègles buffer :\n- Préfère edit_buffer / set_buffer pour modifier le fichier ouvert\n- L'utilisateur fera Push lui-même depuis l'éditeur\n- N'affirme PAS que c'est poussé sur GitHub après un edit_buffer\n`
        : `\nAucun fichier ouvert dans l'éditeur. Demande à l'utilisateur d'en ouvrir un via le panel GitHub, ou utilise list_files / read_file.\n`

    if (!isTokenValid) {
      return `Tu es un assistant dans TrappistCode. Aucun token GitHub connecté.${bufferInfo}`
    }
    if (!selectedRepo) {
      return `Tu es un assistant dans TrappistCode. Token OK mais aucun repo sélectionné.${bufferInfo}`
    }

    let prompt = `Tu es un assistant de code dans TrappistCode (mode type Copilot).\nRepo actif : ${selectedRepo}\nToken GitHub : connecté.\n${bufferInfo}\n\nActions GitHub (UN seul bloc \`\`\`github-action par réponse) :\n\n1) list_files : {"action":"list_files","path":""}\n2) read_file : {"action":"read_file","path":"src/App.tsx"}\n3) create_file (max ~2500 car.) : {"action":"create_file","path":"...","content":"...","message":"..."}\n4) patch_file (sur GitHub direct) : {"action":"patch_file","path":"...","oldText":"...","newText":"...","message":"..."}\n\nRègles :\n- Fichier ouvert → utilise edit_buffer / set_buffer (local)\n- Ne colle PAS de longs fichiers dans ta réponse texte\n- Ne simule pas git/bash\n- Si aucune action : réponds SANS bloc`

    if (autonomous) {
      prompt += `\n\nMODE AUTONOMIE :\n- Une action max par réponse\n- Continue après chaque résultat jusqu'à finir\n- Fin : résumé court SANS bloc`
    }

    // Renforcement fort pour l'agent local
    if (selectedAgent === 'trappist-local') {
      prompt += `

RÈGLES STRICTES POUR TOI (agent local) :
- Fais des modifications TRÈS ciblées et chirurgicales.
- Utilise de préférence un petit bloc edit_buffer avec le texte exact à changer.
- Ne réécris PAS tout le fichier sauf si c'est absolument nécessaire.
- Réponds en français.
- Sois précis et minimaliste dans tes changements.

Format à utiliser :
\`\`\`edit_buffer
{"oldText":"texte exact à remplacer","newText":"nouveau texte"}
\`\`\`
`
    }

    return prompt
  }
  const callLLM = async (apiMessages: Array<{ role: string; content: string }>): Promise<string> => {
    if (selectedAgent === 'trappist-local') {
      const lastUser = apiMessages.filter((m) => m.role === 'user').pop()
      const question = lastUser?.content || 'Bonjour'
      const system = buildSystemPrompt()

      try {
        const res = await axios.post('http://localhost:8000/ask', {
          question,
          system,
          file_content: fileContent || '',
          file_path: openPath || '',
        }, { timeout: 180000 })

        return res.data.final || res.data.reasoning || '(réponse vide)'
      } catch (e: any) {
        return `❌ Erreur agent local : ${e.message || 'serveur non démarré ?'}`
      }
    }

    if (selectedAgent === 'groq') {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model: 'llama-3.1-8b-instant', messages: apiMessages, max_tokens: autonomous ? 3072 : 2048 },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      )
      return extractResponseText(res.data.choices?.[0]?.message)
    }

    const modelMap: Record<string, string> = {
      kimi: 'moonshotai/kimi-k3',
      'kimi-wavespeed': 'moonshotai/kimi-k3',
      claude: 'anthropic/claude-sonnet-4.5',
    }
    const model = modelMap[selectedAgent] ?? 'deepseek/deepseek-v4-flash'
    const res = await axios.post(
      '/api/wavespeed/chat/completions',
      { model, messages: apiMessages, max_tokens: autonomous ? 3072 : 2048 },
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_WAVESPEED_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 180000,
      }
    )
    return extractResponseText(res.data.choices?.[0]?.message)
  }

  const formatLLMError = (e: any): string => {
    const status = e?.response?.status
    if (status === 401) return '❌ Clé API invalide (401)'
    if (status === 413) return '❌ Historique trop long (413). Vide le chat.'
    if (status === 429) return '❌ Rate limit (429). Attends un peu.'
    if (e?.code === 'ECONNABORTED' || status === 504) return '❌ Timeout'
    if (e?.code === 'ERR_NETWORK') return '❌ Erreur réseau'
    console.error(e)
    return `❌ Erreur ${selectedAgent}`
  }

  const runAction = async (action: any): Promise<string> => {
    if (action.action === 'edit_buffer') {
      if (!openPath) return '❌ Aucun fichier ouvert dans l’éditeur'
      if (!onApplyEdit) return '❌ onApplyEdit manquant'
      if (typeof action.oldText !== 'string' || typeof action.newText !== 'string') {
        return '❌ edit_buffer incomplet (oldText/newText)'
      }
      if (!fileContent.includes(action.oldText)) {
        return '❌ oldText introuvable dans le buffer.'
      }
      onApplyEdit(fileContent.replace(action.oldText, action.newText))
      return `✅ Modif appliquée dans l’éditeur (**${openPath}**). Clique Push pour envoyer sur GitHub.`
    }

    if (action.action === 'set_buffer') {
      if (!openPath) return '❌ Aucun fichier ouvert dans l’éditeur'
      if (!onApplyEdit) return '❌ onApplyEdit manquant'
      if (typeof action.content !== 'string') return '❌ set_buffer incomplet (content)'
      onApplyEdit(action.content)
      return `✅ Buffer remplacé dans l’éditeur (**${openPath}**). Clique Push pour envoyer sur GitHub.`
    }

    if (!selectedRepo || !githubToken) return '❌ Token ou repo manquant'
    const { owner, repo } = parseRepoFullName(selectedRepo)

    if (action.action === 'list_files') {
      const files = await listFiles({ token: githubToken, owner, repo, path: action.path || '' })
      const listing = files.map((f) => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`).join('\n')
      return `📂 Contenu de ${action.path || '/'} :\n\n${listing || '(vide)'}`
    }

    if (action.action === 'read_file') {
      if (!action.path) throw new Error('path manquant')
      const file = await readFile({ token: githubToken, owner, repo, path: action.path })
      return `📄 ${file.path} (${file.content.length} car.)\nAperçu:\n\`\`\`\n${truncateContent(file.content)}\n\`\`\``
    }

    if (action.action === 'create_file') {
      if (!action.path || typeof action.content !== 'string') throw new Error('create_file incomplet')
      await createFile({ token: githubToken, owner, repo, path: action.path, content: action.content, message: action.message || `Add ${action.path}` })
      return `✅ Fichier **${action.path}** créé/mis à jour sur GitHub.`
    }

    if (action.action === 'patch_file') {
      if (!action.path || typeof action.oldText !== 'string' || typeof action.newText !== 'string') throw new Error('patch_file incomplet')
      await patchFile({ token: githubToken, owner, repo, path: action.path, oldText: action.oldText, newText: action.newText, message: action.message || `Patch ${action.path}` })
      return `✅ Patch GitHub sur **${action.path}**.`
    }

    return `❌ Action inconnue : ${action.action}`
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input }
    let thread = [...messages, userMessage]
    setMessages(thread)
    setInput('')
    setLoading(true)

    const systemMessage = { role: 'system', content: buildSystemPrompt() }
    let steps = 0

    try {
      while (steps < (autonomous ? MAX_AUTO_STEPS : 1)) {
        steps++

        const recent = thread.slice(-MAX_HISTORY).map((m) => ({
          role: m.role,
          content: truncateContent(m.content),
        }))
        const apiMessages = [systemMessage, ...recent]

        let responseContent = ''
        try {
          responseContent = await callLLM(apiMessages)
        } catch (e: any) {
          responseContent = formatLLMError(e)
          thread = [...thread, { role: 'assistant', content: responseContent }]
          setMessages(thread)
          break
        }

        // Traitement spécial agent local (edit_buffer / set_buffer)
        if (selectedAgent === 'trappist-local') {
          const editMatch = responseContent.match(/```edit_buffer\s*([\s\S]*?)```/)
          const setMatch = responseContent.match(/```set_buffer\s*([\s\S]*?)```/)

          if (editMatch && openPath && onApplyEdit) {
            try {
              const action = JSON.parse(editMatch[1].trim())
              if (fileContent.includes(action.oldText)) {
                onApplyEdit(fileContent.replace(action.oldText, action.newText))
                responseContent += '\n\n✅ Modification appliquée dans l’éditeur.'
              } else {
                responseContent += '\n\n❌ Texte à remplacer non trouvé.'
              }
            } catch {}
          } else if (setMatch && openPath && onApplyEdit) {
            try {
              const action = JSON.parse(setMatch[1].trim())
              onApplyEdit(action.content)
              responseContent += '\n\n✅ Fichier remplacé dans l’éditeur.'
            } catch {}
          }
        }

        thread = [...thread, { role: 'assistant', content: responseContent }]
        setMessages(thread)

        const action = extractAction(responseContent)
        if (!action) break

        if (action.__parseError) {
          thread = [...thread, { role: 'assistant', content: '❌ Action invalide : JSON tronqué.' }]
          setMessages(thread)
          break
        }

        let result = ''
        try {
          result = await runAction(action)
        } catch (e: any) {
          const status = e?.response?.status
          const errMsg = e?.response?.data?.message || e?.message || 'Erreur inconnue'
          result = `❌ Erreur (${status || '?'}) : ${errMsg}`
        }

        thread = [...thread, { role: 'assistant', content: result }]
        setMessages(thread)

        if (!autonomous) break
      }

      if (autonomous && steps >= MAX_AUTO_STEPS) {
        thread = [...thread, { role: 'assistant', content: `⏹️ Limite autonomie (${MAX_AUTO_STEPS} étapes).` }]
        setMessages(thread)
      }
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => setMessages([])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ height: '35px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #3e3e42', display: 'flex', alignItems: 'center', paddingLeft: '16px', flexShrink: 0 }}>
        <div style={{ padding: '0 16px', borderTop: '2px solid #007acc', backgroundColor: '#1e1e1e' }}>chat.tsx</div>
        <button onClick={clearChat} style={{ marginLeft: '12px', background: 'transparent', border: '1px solid #3e3e42', color: '#cccccc', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
          Vider le chat
        </button>
        <label style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: autonomous ? '#4ec9b0' : '#cccccc', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={autonomous} onChange={(e) => setAutonomous(e.target.checked)} />
          Autonomie
        </label>
        <div style={{ marginLeft: 'auto', paddingRight: '16px', fontSize: '11px', color: openPath ? '#4ec9b0' : '#666' }}>
          {openPath ? `📝 ${openPath}` : 'aucun fichier'}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#666', marginTop: '80px' }}>Ouvre un fichier à droite, puis demande une modif…</div>}
        {messages.map((msg, index) => (
          <div key={index} style={{ maxWidth: '90%', padding: '16px', borderRadius: '8px', backgroundColor: msg.role === 'user' ? '#094771' : '#252526', color: '#cccccc', whiteSpace: 'pre-wrap', wordBreak: 'break-word', flexShrink: 0 }}>
            {displayContent(msg.content) || '(message vide)'}
          </div>
        ))}
        {loading && <div style={{ color: '#666' }}>Agent réfléchit{autonomous ? ' (autonomie)...' : '...'}</div>}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #3e3e42', backgroundColor: '#252526', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ex: ajoute un commentaire en haut du fichier ouvert" style={{ flex: 1, backgroundColor: '#3c3c3c', border: '1px solid #3e3e42', borderRadius: '4px', padding: '12px', color: '#cccccc', outline: 'none' }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ backgroundColor: '#007acc', color: 'white', padding: '0 32px', borderRadius: '4px', cursor: loading || !input.trim() ? 'default' : 'pointer', border: 'none', opacity: loading || !input.trim() ? 0.6 : 1 }}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

export default Chat