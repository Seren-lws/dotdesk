export interface Project {
  id: string
  name: string
  description: string | null
  url: string | null
  repo_url: string | null
  status: 'deployed' | 'building' | 'planning' | 'archived'
  color: string
  sort_order: number
}

export interface GitHubCommit {
  sha: string
  message: string
  committed_at: string
  url: string
}

export interface GitHubRepositoryActivity {
  repo: string
  commits: GitHubCommit[]
}

export interface Bookmark {
  id: string
  name: string
  url: string
  category: string
  icon: string | null
  sort_order: number
}

export type PixelColor =
  | 'rose' | 'sage' | 'sky' | 'lavender' | 'sand'
  | 'peach' | 'mint' | 'lilac' | 'butter'
