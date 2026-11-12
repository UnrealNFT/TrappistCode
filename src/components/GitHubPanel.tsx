import { useState, useEffect } from 'react'
import axios from 'axios'
import { listFiles, readFile, parseRepoFullName } from '../services/github'

interface Repo {
  id: number
  full_name: string
  private: boolean
  html_url: string
}

interface FileItem {
  name: string
  path: string
  type: string
  size?: number
}

interface GitHubPanelProps {
  githubToken: string
  setGithubToken: (token: string) => void
  isTokenValid: boolean
  setIsTokenValid: (valid: boolean) => void
  selectedRepo: string | null
  setSelectedRepo: (repo: string | null) => void
  openPath: string | null
  onOpenFile: (path: string, content: string) => void
}

function GitHubPanel({
  githubToken,
  setGithubToken,
  isTokenValid,
  setIsTokenValid,
  selectedRepo,
  setSelectedRepo,
  openPath,
  onOpenFile,
}: GitHubPanelProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [githubUser, setGithubUser] = useState('')

  const [files, setFiles] = useState<FileItem[]>([])
  const [dirPath, setDirPath] = useState('')
  const [filesLoading, setFilesLoading] = useState(false)
  const [fileError, setFileError] = useState('')

  const connectGitHub = async () => {
    if (!githubToken.trim()) {
      setError('Token vide')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userRes = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      })
      setGithubUser(userRes.data.login)

      const reposRes = await axios.get(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      )
      setRepos(reposRes.data)
      setIsTokenValid(true)
    } catch {
      setError('Token invalide ou erreur API')
      setIsTokenValid(false)
      setRepos([])
      setGithubUser('')
    }

    setLoading(false)
  }

  const disconnect = () => {
    setGithubToken('')
    setIsTokenValid(false)
    setSelectedRepo(null)
    setRepos([])
    setGithubUser('')
    setError('')
    setFiles([])
    setDirPath('')
  }

  const loadDir = async (path = '') => {
    if (!selectedRepo || !githubToken) return
    setFilesLoading(true)
    setFileError('')
    try {
      const { owner, repo } = parseRepoFullName(selectedRepo)
      const list = await listFiles({
        token: githubToken,
        owner,
        repo,
        path,
      })
      setFiles(list)
      setDirPath(path)
    } catch (e: any) {
      setFileError(e?.response?.data?.message || e.message || 'Erreur listing')
      setFiles([])
    }
    setFilesLoading(false)
  }

  useEffect(() => {
    if (isTokenValid && selectedRepo && githubToken) {
      loadDir('')
    } else {
      setFiles([])
      setDirPath('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, isTokenValid])

  const openFileClick = async (item: FileItem) => {
    if (item.type === 'dir') {
      loadDir(item.path)
      return
    }
    if (!selectedRepo || !githubToken) return
    setFilesLoading(true)
    setFileError('')
    try {
      const { owner, repo } = parseRepoFullName(selectedRepo)
      const file = await readFile({
        token: githubToken,
        owner,
        repo,
        path: item.path,
      })
      onOpenFile(file.path, file.content)
    } catch (e: any) {
      setFileError(e?.response?.data?.message || e.message || 'Erreur lecture')
    }
    setFilesLoading(false)
  }

  const goUp = () => {
    if (!dirPath) return
    const parts = dirPath.split('/').filter(Boolean)
    parts.pop()
    loadDir(parts.join('/'))
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          color: '#858585',
          marginBottom: '8px',
        }}
      >
        GitHub
      </div>

      {!isTokenValid ? (
        <>
          <input
            type="password"
            placeholder="Coller ton token..."
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#3c3c3c',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              color: '#cccccc',
              fontSize: '12px',
              marginBottom: '8px',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={connectGitHub}
            disabled={loading}
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: '#0e639c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Connexion...' : 'Connecter'}
          </button>
          {error && (
            <div style={{ color: '#f14c4c', fontSize: '11px', marginTop: '6px' }}>
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: '12px', color: '#4ec9b0', marginBottom: '6px' }}>
            ✓ {githubUser}
          </div>

          <button
            onClick={disconnect}
            style={{
              padding: '4px 8px',
              backgroundColor: '#3c3c3c',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              color: '#cccccc',
              fontSize: '11px',
              cursor: 'pointer',
              marginBottom: '12px',
            }}
          >
            Déconnecter
          </button>

          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#858585',
              marginBottom: '6px',
            }}
          >
            Repos
          </div>
          <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '12px' }}>
            {repos.map((repo) => (
              <div
                key={repo.id}
                onClick={() => setSelectedRepo(repo.full_name)}
                style={{
                  padding: '6px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor:
                    selectedRepo === repo.full_name ? '#37373d' : 'transparent',
                  color: selectedRepo === repo.full_name ? 'white' : '#cccccc',
                  borderRadius: '4px',
                  marginBottom: '2px',
                }}
              >
                {repo.private ? '🔒' : '🌐'} {repo.full_name}
              </div>
            ))}
          </div>

          {selectedRepo && (
            <>
              <div
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: '#858585',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Fichiers
                {dirPath && (
                  <button
                    onClick={goUp}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: '#3c3c3c',
                      border: '1px solid #3e3e42',
                      color: '#ccc',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    ↑ ..
                  </button>
                )}
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: 6 }}>
                /{dirPath || ''}
              </div>
              {fileError && (
                <div style={{ color: '#f14c4c', fontSize: '11px', marginBottom: 6 }}>
                  {fileError}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {filesLoading ? (
                  <div style={{ fontSize: 12, color: '#666' }}>Chargement...</div>
                ) : (
                  files
                    .slice()
                    .sort((a, b) => {
                      if (a.type === b.type) return a.name.localeCompare(b.name)
                      return a.type === 'dir' ? -1 : 1
                    })
                    .map((item) => (
                      <div
                        key={item.path}
                        onClick={() => openFileClick(item)}
                        style={{
                          padding: '5px 8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          backgroundColor:
                            openPath === item.path ? '#094771' : 'transparent',
                          color: openPath === item.path ? '#fff' : '#cccccc',
                          borderRadius: '4px',
                          marginBottom: '1px',
                        }}
                      >
                        {item.type === 'dir' ? '📁' : '📄'} {item.name}
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default GitHubPanel