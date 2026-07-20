import { useState } from 'react'
import axios from 'axios'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])

  const sendMessage = async () => {
    if (!input) return

    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')

    try {
      const res = await axios.post('https://api.wavespeed.ai/v1/chat/completions', {
        model: "anthropic/claude-sonnet-4.5",
        messages: newMessages
      }, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_WAVESPEED_KEY}` }
      })

      const reply = res.data.choices[0].message.content
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar - Fichiers */}
      <div className="w-80 border-r border-gray-700 p-4 overflow-auto">
        <h2 className="text-lg font-bold mb-4">📁 Fichiers</h2>
        <div className="space-y-1">
          {files.map(f => <div key={f} className="p-2 hover:bg-gray-800 rounded">{f}</div>)}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-gray-950">
          <h1 className="text-xl font-bold">🤖 Claude - AI Cover Assistant</h1>
        </div>

        <div className="flex-1 p-4 overflow-auto space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-lg max-w-[80%] ${m.role === 'user' ? 'ml-auto bg-blue-600' : 'bg-gray-800'}`}>
              {m.content}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-950">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2"
              placeholder="Dis à Claude ce que tu veux faire..."
            />
            <button onClick={sendMessage} className="bg-blue-600 px-6 rounded">Envoyer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App