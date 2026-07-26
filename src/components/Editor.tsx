import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { createFile, parseRepoFullName } from '../services/github'

interface Props {
  githubToken: string
  selectedRepo: string | null
  openPath: string | null
  content: string
  savedContent: string
  onChange: (content: string) => void
  onSaved: () => void
}

const LANGS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  md: 'Markdown',
  py: 'Python',
}

const btn: React.CSSProperties = {
  backgroundColor: '#3c3c3c',
  color: '#cccccc',
  border: '1px solid #3e3e42',
  borderRadius: '4px',
  padding: '4px 10px',
  fontSize: '12px',
  cursor: 'pointer',
}

function langExtension(path: string | null) {
  const ext = path?.split('.').pop()?.toLowerCase() || ''
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return javascript({ jsx: true, typescript: ext === 'ts' || ext === 'tsx' })
  }
  if (ext === 'html' || ext === 'htm') return html()
  if (ext === 'css') return css()
  if (ext === 'json') return json()
  if (ext === 'md' || ext === 'markdown') return markdown()
  if (ext === 'py') return python()
  return javascript()
}

function Editor({
  githubToken,
  selectedRepo,
  openPath,
  content,
  savedContent,
  onChange,
  onSaved,
}: Props) {
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const dirty = openPath !== null && content !== savedContent
  const ext = openPath?.split('.').pop()?.toLowerCase() || ''
  const langLabel = LANGS[ext] || (openPath ? 'Plain Text' : '—')
  const lines = content ? content.split('\n').length : 0
  const repo = selectedRepo ? parseRepoFullName(selectedRepo) : null

  const extensions = useMemo(
    () => [langExtension(openPath), oneDark],
    [openPath]
  )

  const save = async () => {
    if (!openPath) return setStatus('Aucun fichier ouvert')
    if (!githubToken || !repo) return setStatus('Token ou repo manquant')
    setSaving(true)
    setStatus('Push en cours...')
    try {
      await createFile({
        token: githubToken,
        owner: repo.owner,
        repo: repo.repo,
        path: openPath,
        content,
        message: `Update ${openPath} via TrappistCode`,
      })
      onSaved()
      setStatus('Poussé sur GitHub')
      setTimeout(() => setStatus(''), 2500)
    } catch (e: any) {
      setStatus('Erreur: ' + (e?.response?.data?.message || e.message))
    }
    setSaving(false)
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: '#2d2d30',
          borderBottom: '1px solid #3e3e42',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: '12px',
            fontFamily: 'Consolas, monospace',
            color: openPath ? '#cccccc' : '#666',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {openPath || 'Aucun fichier — choisis-en un dans le panel GitHub'}
          {dirty ? ' •' : ''}
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving || !openPath}
          style={{
            ...btn,
            backgroundColor: dirty ? '#0e639c' : '#3c3c3c',
            opacity: dirty && !saving && openPath ? 1 : 0.5,
            cursor: dirty && !saving && openPath ? 'pointer' : 'default',
          }}
        >
          {saving ? '…' : `Push${dirty ? ' *' : ''}`}
        </button>
      </div>

      {/* CodeMirror — zone scrollable */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {openPath ? (
          <CodeMirror
            value={content}
            height="100%"
            theme={oneDark}
            extensions={extensions}
            onChange={(v) => onChange(v)}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              indentOnInput: true,
              tabSize: 2,
            }}
            style={{
              flex: 1,
              minHeight: 0,
              fontSize: '13px',
              height: '100%',
            }}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6e7681',
              fontSize: 14,
            }}
          >
            Ouvre un fichier depuis le panel GitHub
          </div>
        )}
      </div>

      {/* Status */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          padding: '3px 12px',
          backgroundColor: '#007acc',
          color: '#fff',
          fontSize: '12px',
          flexShrink: 0,
        }}
      >
        <span>{lines} lignes</span>
        <span>{langLabel}</span>
        <span style={{ marginLeft: 'auto' }}>
          {status}
          {dirty ? ' (non sauvegardé)' : ''}
        </span>
      </div>
    </div>
  )
}

export default Editor