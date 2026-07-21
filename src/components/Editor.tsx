import { useState } from 'react'

function Editor() {
  const [code, setCode] = useState('// Ton code ici')
  const [fileName, setFileName] = useState('App.tsx')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
      <div style={{ padding: '8px 12px', backgroundColor: '#252526', borderBottom: '1px solid #3e3e42' }}>
        {fileName}
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ flex: 1, backgroundColor: '#1e1e1e', color: '#cccccc', padding: '16px', border: 'none', fontFamily: 'Consolas, monospace', fontSize: '14px', resize: 'none', outline: 'none' }}
      />
    </div>
  )
}

export default Editor