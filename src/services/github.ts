import axios from 'axios'

/**
 * Crée (ou met à jour) un fichier sur GitHub
 * et fait un commit automatiquement.
 */
export async function createFile(params: {
  token: string
  owner: string      // ex: "UnrealNFT"
  repo: string       // ex: "opencodeAI"
  path: string       // ex: "index.html"
  content: string    // contenu du fichier
  message?: string   // message de commit
}) {
  const { token, owner, repo, path, content, message } = params

  // GitHub attend le contenu en base64
  const contentBase64 = btoa(unescape(encodeURIComponent(content)))

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  const response = await axios.put(
    url,
    {
      message: message || `Add ${path}`,
      content: contentBase64
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  return response.data
}

/**
 * Sépare "UnrealNFT/opencodeAI" en owner + repo
 */
export function parseRepoFullName(fullName: string) {
  const [owner, repo] = fullName.split('/')
  return { owner, repo }
}