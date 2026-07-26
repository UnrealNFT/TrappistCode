import { useState } from 'react'
import Chat from './components/Chat'
import GitHubPanel from './components/GitHubPanel'
import Editor from './components/Editor'

function App() {
  const [selectedAgent, setSelectedAgent] = useState<
    'groq' | 'kimi' | 'claude' | 'kimi-wavespeed'
  >('groq')
  const [githubToken, setGithubToken] = useState('')
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#cccccc',
        fontFamily: 'Consolas, monospace',
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: '36px',
          backgroundColor: '#323233',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontSize: '13px',
          flexShrink: 0,
        }}
      >
        TrappistAI
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
          }}
        >
          Agent :
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as any)}
            style={{
              backgroundColor: '#3c3c3c',
              color: '#cccccc',
              border: '1px solid #3e3e42',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            <option value="groq">Groq</option>
            <option value="kimi">Kimi</option>
            <option value="claude">Claude</option>
            <option value="kimi-wavespeed">Kimi 2.7 WaveSpeed</option>
          </select>
        </div>
      </div>

      {/* Main: sidebar + chat + editor */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* GitHub panel */}
        <div
          style={{
            width: '280px',
            backgroundColor: '#252526',
            borderRight: '1px solid #3e3e42',
            flexShrink: 0,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <GitHubPanel
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            isTokenValid={isTokenValid}
            setIsTokenValid={setIsTokenValid}
            selectedRepo={selectedRepo}
            setSelectedRepo={setSelectedRepo}
          />
        </div>

        {/* Chat */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            borderRight: '1px solid #3e3e42',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Chat
            selectedAgent={selectedAgent}
            githubToken={githubToken}
            isTokenValid={isTokenValid}
            selectedRepo={selectedRepo}
          />
        </div>

        {/* Editor */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Editor
            githubToken={githubToken}
            selectedRepo={selectedRepo}
            filePath="src/App.tsx"
          />
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          height: '28px',
          backgroundColor: '#007acc',
          color: 'white',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '16px',
          flexShrink: 0,
        }}
      >
        <span>{selectedAgent}</span>
        <span>{isTokenValid ? 'GitHub OK' : 'GitHub off'}</span>
        {selectedRepo && <span>{selectedRepo}</span>}
      </div>
    </div>
  )
}

export default App