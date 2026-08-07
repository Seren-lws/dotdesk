const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const repositories = [
  'evering',
  '79-brain',
  'desirelogue',
  'life-library',
  'life-garden',
  'seren-collected',
  'sheng-ledger',
  'clipboard-warehouse',
  'tenshoku-fune',
  'dotdesk',
  'cyber-home',
  'nowhere',
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const token = Deno.env.get('GITHUB_TOKEN')
  if (!token) {
    return json({ error: 'GitHub activity is not configured' }, 503)
  }

  const fields = repositories.map((repo, index) => `
    repo${index}: repository(owner: "Seren-lws", name: "${repo}") {
      name
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 3) {
              nodes {
                oid
                messageHeadline
                committedDate
                url
              }
            }
          }
        }
      }
    }
  `).join('\n')

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'dotdesk-project-activity',
      },
      body: JSON.stringify({ query: `query DotdeskActivity { ${fields} }` }),
    })

    if (!response.ok) {
      console.error('GitHub request failed:', response.status)
      return json({ error: 'Failed to fetch GitHub activity' }, 502)
    }

    const payload = await response.json()
    if (!payload.data) {
      console.error('GitHub GraphQL errors:', payload.errors)
      return json({ error: 'Failed to fetch GitHub activity' }, 502)
    }

    const result = repositories.map((repo, index) => {
      const nodes = payload.data[`repo${index}`]?.defaultBranchRef?.target?.history?.nodes || []
      return {
        repo,
        commits: nodes.map((commit: {
          oid: string
          messageHeadline: string
          committedDate: string
          url: string
        }) => ({
          sha: commit.oid,
          message: commit.messageHeadline,
          committed_at: commit.committedDate,
          url: commit.url,
        })),
      }
    })

    return json({ repositories: result })
  } catch (error) {
    console.error('Unexpected GitHub activity error:', error)
    return json({ error: 'Failed to fetch GitHub activity' }, 500)
  }
})
