import { useState, useRef } from 'react'
import { readFile, createFile, parseRepoFullName } from '../services/github'

interface Props {
  githubToken: string
  selectedRepo: string | null
  filePath?: string
}

const LANGS: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
  json: 'JSON', css: 'CSS', html: 'HTML', md: 'Markdown', py: 'Python',
}

const btn: React.CSSProperties = {
  backgroundColor: '#3c3c3c', color: '#cccccc', border: '1px solid #3e3e42',
  borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
}

function Editor({ githubToken, selectedRepo, filePath = 'src/App.tsx' }: Props) {
  const [path, setPath] = useState(filePath)
  const [code, setCode] = useState('// Ouvre un fichier GitHub...\n')
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const ext = path.split('.').pop()?.toLowerCase() || ''
  const lang = LANGS[ext] || 'Plain Text'
  const lines = code.split('\n')
  const repo = selectedRepo ? parseRepoFullName(selectedRepo) : null

  const load = async () => {
    if (!githubToken || !repo) return setStatus('Token ou repo manquant')
    setStatus('Chargement...')
    try {
      const f = await readFile({ token: githubToken, owner: repo.owner, repo: repo.repo, path })
      setCode(f.content)
      setDirty(false)
      setStatus('Charge')
    } catch (e: any) {
      setStatus(e.response?.status === 404 ? 'Fichier introuvable' : 'Erreur: ' + e.message)
    }
  }

  const save = async () => {
    if (!githubToken || !repo) return setStatus('Token ou repo manquant')
    setStatus('Push en cours...')
    try {
      await createFile({ token: githubToken, owner: repo.owner, repo: repo.repo, path, content: code })
      setDirty(false)
      setStatus('Pushe sur GitHub')
    } catch (e: any) {
      setStatus('Erreur: ' + e.message)
    }
  }

  const syncCursor = () => {
    const ta = taRef.current
    if (!ta) return
    const before = ta.value.slice(0, ta.selectionStart)
    setCursor({ line: before.split('\n').length, col: before.length - before.lastIndexOf('\n') })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: en, value } = ta
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      setCode(value.slice(0, s) + '  ' + value.slice(en))
      setDirty(true)
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2))
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
        <input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: 1, backgroundColor: '#3c3c3c', color: '#cccccc', border: '1px solid #3e3e42', borderRadius: '4px', padding: '4px 8px', fontFamily: 'Consolas, monospace', fontSize: '12px', outline: 'none' }} />
        <button onClick={load} style={btn}>Ouvrir</button>
        <button onClick={save} style={{ ...btn, backgroundColor: dirty ? '#0e639c' : '#3c3c3c' }}>Push{dirty ? ' *' : ''}</button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ padding: '12px 8px', textAlign: 'right', color: '#6e7681', fontFamily: 'Consolas, monospace', fontSize: '14px', lineHeight: '21px', userSelect: 'none', minWidth: '44px', overflow: 'hidden' }}>
          {lines.map((_, i) => (
            <div key={i} style={{ color: i + 1 === cursor.line ? '#c6c6c6' : undefined }}>{i + 1}</div>
          ))}
        </div>
        <textarea ref={taRef} value={code}
          onChange={(e) => { setCode(e.target.value); setDirty(true); syncCursor() }}
          onKeyDown={onKeyDown} onKeyUp={syncCursor} onClick={syncCursor} spellCheck={false}
          style={{ flex: 1, backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '12px', border: 'none', fontFamily: 'Consolas, Monaco, monospace', fontSize: '14px', lineHeight: '21px', resize: 'none', outline: 'none', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }} />
      </div>
      <div style={{ display: 'flex', gap: '16px', padding: '3px 12px', backgroundColor: '#007acc', color: '#fff', fontSize: '12px' }}>
        <span>Ln {cursor.line}, Col {cursor.col}</span>
        <span>{lines.length} lignes</span>
        <span>{lang}</span>
        <span style={{ marginLeft: 'auto' }}>{status}{dirty ? ' (non sauvegarde)' : ''}</span>
      </div>
    </div>
  )
}

export default Editor
