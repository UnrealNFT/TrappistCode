import axios from 'axios'

export function parseRepoFullName(fullName: string) {
  const [owner, repo] = fullName.split('/')
  return { owner, repo }
}

/**
 * Crée ou met à jour un fichier sur GitHub (commit auto)
 */
export async function createFile(params: {
  token: string
  owner: string
  repo: string
  path: string
  content: string
  message?: string
}) {
  const { token, owner, repo, path, content, message } = params
  const contentBase64 = btoa(unescape(encodeURIComponent(content)))
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  let sha: string | undefined
  try {
    const existing = await axios.get(url, { headers })
    sha = existing.data.sha
  } catch {
    // 404 = fichier absent → création
  }

  const body: {
    message: string
    content: string
    sha?: string
  } = {
    message: message || (sha ? `Update ${path}` : `Add ${path}`),
    content: contentBase64,
  }

  if (sha) {
    body.sha = sha
  }

  const response = await axios.put(url, body, { headers })
  return response.data
}

/**
 * Liste le contenu d'un dossier (path "" = racine)
 */
export async function listFiles(params: {
  token: string
  owner: string
  repo: string
  path?: string
}) {
  const { token, owner, repo, path = '' } = params
  const url = path
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    : `https://api.github.com/repos/${owner}/${repo}/contents`

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  const data = res.data
  if (Array.isArray(data)) {
    return data.map(
      (item: { name: string; path: string; type: string; size?: number }) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
      })
    )
  }

  return [
    {
      name: data.name,
      path: data.path,
      type: data.type,
      size: data.size,
    },
  ]
}

/**
 * Lit le contenu texte d'un fichier
 */
export async function readFile(params: {
  token: string
  owner: string
  repo: string
  path: string
}) {
  const { token, owner, repo, path } = params
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (res.data.type !== 'file') {
    throw new Error('Ce chemin n’est pas un fichier')
  }

  const content = decodeURIComponent(
    escape(atob(res.data.content.replace(/\n/g, '')))
  )

  return {
    path: res.data.path,
    content,
    sha: res.data.sha,
  }
}

/**
 * Patch un fichier : remplace oldText par newText (1ère occurrence)
 * Puis commit via createFile (update avec sha)
 */
export async function patchFile(params: {
  token: string
  owner: string
  repo: string
  path: string
  oldText: string
  newText: string
  message?: string
}) {
  const { token, owner, repo, path, oldText, newText, message } = params

  const current = await readFile({ token, owner, repo, path })

  if (!current.content.includes(oldText)) {
    throw new Error(
      `Texte introuvable dans ${path}. Vérifie que oldText correspond exactement.`
    )
  }

  const updated = current.content.replace(oldText, newText)

  return createFile({
    token,
    owner,
    repo,
    path,
    content: updated,
    message: message || `Patch ${path}`,
  })
}