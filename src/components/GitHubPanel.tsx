import { useState } from 'react'
import axios from 'axios'

interface Repo {
  id: number
  full_name: string
  private: boolean
  html_url: string
}

interface GitHubPanelProps {
  githubToken: string
  setGithubToken: (token: string) => void
  isTokenValid: boolean
  setIsTokenValid: (valid: boolean) => void
  selectedRepo: string | null
  setSelectedRepo: (repo: string | null) => void
}

function GitHubPanel({
  githubToken,
  setGithubToken,
  isTokenValid,
  setIsTokenValid,
  selectedRepo,
  setSelectedRepo
}: GitHubPanelProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [githubUser, setGithubUser] = useState('')

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
          Accept: 'application/vnd.github+json'
        }
      })
      setGithubUser(userRes.data.login)

      const reposRes = await axios.get(
        'https://api.github.com/user/repos?per_page=100&sort=updated',
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json'
          }
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
  }

  return (
    <div style={{ padding: '12px', borderBottom: '1px solid #3e3e42' }}>
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          color: '#858585',
          marginBottom: '8px'
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
              boxSizing: 'border-box'
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
              cursor: loading ? 'wait' : 'pointer'
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
              marginBottom: '12px'
            }}
          >
            Déconnecter
          </button>

          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#858585',
              marginBottom: '6px'
            }}
          >
            Repos
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
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
                  marginBottom: '2px'
                }}
              >
                {repo.private ? '🔒' : '🌐'} {repo.full_name}
              </div>
            ))}
          </div>

          {selectedRepo && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#4ec9b0' }}>
              Actif : {selectedRepo}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default GitHubPanel