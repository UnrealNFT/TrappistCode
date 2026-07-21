import { useState } from 'react'
import Chat from './components/Chat'

function App() {
  const [selectedAgent, setSelectedAgent] = useState<'groq' | 'kimi' | 'claude'>('groq')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#1e1e1e', color: '#cccccc', fontFamily: 'Consolas, monospace', overflow: 'hidden' }}>
      {/* Title Bar */}
      <div style={{ height: '36px', backgroundColor: '#323233', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '13px' }}>
        TrappistAI - Chat avec Groq + Kimi + Claude
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
          Agent :
          <select 
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as 'groq' | 'kimi' | 'claude')}
            style={{ backgroundColor: '#3c3c3c', color: '#cccccc', border: '1px solid #3e3e42', padding: '4px 8px', borderRadius: '4px' }}
          >
            <option value="groq">Groq (llama-3.1-8b)</option>
            <option value="kimi">Kimi K3 (Moonshot)</option>
            <option value="claude">Claude Sonnet 4.5</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Activity Bar */}
        <div style={{ width: '48px', backgroundColor: '#2d2d30', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px', gap: '24px' }}>
          <div style={{ fontSize: '24px' }}>💬</div>
          <div style={{ fontSize: '24px', opacity: 0.4 }}>📁</div>
          <div style={{ fontSize: '24px', opacity: 0.4 }}>🔍</div>
        </div>

        {/* Sidebar */}
        <div style={{ width: '280px', backgroundColor: '#252526', borderRight: '1px solid #3e3e42' }}>
          <div style={{ padding: '12px', fontSize: '11px', textTransform: 'uppercase', color: '#858585' }}>Conversations</div>
          <div style={{ padding: '8px 16px', backgroundColor: '#37373d', color: 'white' }}>Agent Principal</div>
        </div>

        {/* Chat */}
        <Chat selectedAgent={selectedAgent} />
      </div>

      {/* Status Bar */}
      <div style={{ height: '28px', backgroundColor: '#007acc', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        Agent actif : {selectedAgent.toUpperCase()}
      </div>
    </div>
  )
}

export default App