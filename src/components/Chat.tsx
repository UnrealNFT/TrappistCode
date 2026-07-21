import { useState } from 'react'
import axios from 'axios'

interface ChatProps {
  selectedAgent: 'groq' | 'kimi' | 'claude'
}

function Chat({ selectedAgent }: ChatProps) {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    let responseContent = ''

    if (selectedAgent === 'groq') {
      try {
        const groqRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: "llama-3.1-8b-instant",
          messages: updatedMessages
        }, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_KEY}` }
        })
        responseContent = groqRes.data.choices[0].message.content
      } catch (e) {
        responseContent = "Erreur Groq"
      }
    } else {
      const model = selectedAgent === 'kimi' ? "moonshotai/kimi-k3" : "anthropic/claude-sonnet-4.5"
      try {
        const res = await axios.post('/wavespeed/v1/chat/completions', {
          model,
          messages: updatedMessages
        }, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_WAVESPEED_KEY}` },
          timeout: 600000
        })
        responseContent = res.data.choices[0].message.content
      } catch (e) {
        responseContent = "Erreur " + selectedAgent
      }
    }

    setMessages(prev => [...prev, { role: 'assistant', content: responseContent }])
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Tab Bar */}
      <div style={{ height: '35px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #3e3e42', display: 'flex', alignItems: 'center', paddingLeft: '16px' }}>
        <div style={{ padding: '0 16px', borderTop: '2px solid #007acc', backgroundColor: '#1e1e1e' }}>chat.tsx</div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#666', marginTop: '80px' }}>Commence à parler...</div>}
        {messages.map((msg, index) => (
          <div key={index} style={{ maxWidth: '90%', padding: '16px', borderRadius: '8px', backgroundColor: msg.role === 'user' ? '#094771' : '#1e1e1e' }}>
            {msg.role === 'assistant' ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content.split('```').map((part, i) => {
                  if (i % 2 === 1) {
                    return (
                      <pre key={i} style={{ 
                        backgroundColor: '#0d1117', 
                        padding: '20px', 
                        borderRadius: '6px', 
                        fontFamily: 'Consolas, monospace', 
                        fontSize: '14px', 
                        lineHeight: '1.5', 
                        color: '#c9d1d9',
                        overflowX: 'auto',
                        margin: '12px 0'
                      }}>
                        {part}
                      </pre>
                    )
                  }
                  return <div key={i} style={{ marginBottom: '12px' }}>{part}</div>
                })}
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{msg.content}</div>
            )}
          </div>
        ))}
        {loading && <div style={{ color: '#666' }}>Agent réfléchit...</div>}
      </div>

      {/* Input */}
      <div style={{ padding: '16px', borderTop: '1px solid #3e3e42', backgroundColor: '#252526' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Dis ce que tu veux faire..."
            style={{ flex: 1, backgroundColor: '#3c3c3c', border: '1px solid #3e3e42', borderRadius: '4px', padding: '12px', color: '#cccccc', outline: 'none' }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{ backgroundColor: '#007acc', color: 'white', padding: '0 32px', borderRadius: '4px', cursor: 'pointer', border: 'none' }}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

export default Chat