// Search GitHub for repositories that use the "viem" library
// and export results as JSON ordered by stars

interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  stars: number
  url: string
  language: string | null
  created_at: string
  updated_at: string
}

interface GitHubCodeSearchResponse {
  total_count: number
  incomplete_results: boolean
  items: Array<{
    name: string
    path: string
    sha: string
    url: string
    git_url: string
    html_url: string
    repository: {
      id: number
      node_id: string
      name: string
      full_name: string
      private: boolean
      owner: {
        login: string
        id: number
        node_id: string
        avatar_url: string
        gravatar_id: string
        url: string
        html_url: string
        type: string
        site_admin: boolean
      }
      html_url: string
      description?: string
      fork: boolean
      url: string
      stargazers_count: number
      language: string | null
      created_at: string
      updated_at: string
    }
    score: number
    text_matches?: Array<{
      object_url: string
      object_type: string
      property: string
      fragment: string
      matches: Array<{
        text: string
        indices: number[]
      }>
    }>
  }>
}

async function searchViemRepos() {
  try {
    console.log(
      'Searching GitHub for repositories with "viem" in package.json...'
    )

    // Check if GitHub token is set
    if (!process.env.GITHUB_TOKEN) {
      console.error(
        '❌ Error: GITHUB_TOKEN environment variable is required for Code Search API'
      )
      console.error('Please set it with: export GITHUB_TOKEN=your_token_here')
      console.error('Get a token at: https://github.com/settings/tokens')
      process.exit(1)
    }

    // Search for "viem" in package.json files using Code Search API
    // Using text-match media type for enhanced results
    // Note: The web UI query syntax differs from API syntax
    const query = 'viem filename:package.json -is:archived'
    const encodedQuery = encodeURIComponent(query)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.text-match+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    // Fetch multiple pages to get up to 1,000 results (API maximum)
    const uniqueRepoNames = new Set<string>()
    const maxPages = 10 // API allows max 1,000 results (10 pages × 100)
    const perPage = 100
    let totalCount = 0

    console.log('Fetching code search results (up to 1,000 files)...')

    for (let page = 1; page <= maxPages; page++) {
      const url = `https://api.github.com/search/code?q=${encodedQuery}&per_page=${perPage}&page=${page}`

      const response = await fetch(url, { headers })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}\n${errorText}`
        )
      }

      const data = (await response.json()) as GitHubCodeSearchResponse

      if (page === 1) {
        totalCount = data.total_count
        console.log(
          `Found ${data.total_count.toLocaleString()} total files (API limit: 1,000 max)`
        )
      }

      // Extract unique repository names from this page
      for (const item of data.items) {
        uniqueRepoNames.add(item.repository.full_name)
      }

      console.log(
        `Page ${page}/${maxPages}: ${data.items.length} files, ${uniqueRepoNames.size} unique repos so far`
      )

      // Stop if we got fewer results than requested (last page)
      if (data.items.length < perPage) {
        console.log(`Reached last page of results`)
        break
      }

      // Rate limiting: wait between requests (Code Search API: 10 req/min)
      if (page < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 7000)) // 7 seconds
      }
    }

    console.log(`Found ${uniqueRepoNames.size} unique repositories`)
    console.log('Fetching full repository details...')

    // Fetch full details for each repository
    // Repository API allows 5000 requests/hour, but be conservative with rate limiting
    const repositories: GitHubRepo[] = []
    let fetchedCount = 0

    for (const fullName of uniqueRepoNames) {
      try {
        const repoResponse = await fetch(
          `https://api.github.com/repos/${fullName}`,
          { headers }
        )

        if (repoResponse.ok) {
          const repoData = (await repoResponse.json()) as any
          repositories.push({
            name: repoData.name,
            full_name: repoData.full_name,
            description: repoData.description,
            stars: repoData.stargazers_count,
            url: repoData.html_url,
            language: repoData.language,
            created_at: repoData.created_at,
            updated_at: repoData.updated_at,
          })
          fetchedCount++

          if (fetchedCount % 50 === 0) {
            console.log(
              `Fetched ${fetchedCount}/${uniqueRepoNames.size} repositories...`
            )
          }
        }

        // Rate limiting: 1 request per second to be safe
        // Edit: no rate limit needed, GitHub allows 5000 requests/hour to this endpoint
        // await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error fetching ${fullName}:`, error)
      }
    }

    // Sort by stars (descending)
    repositories.sort((a, b) => b.stars - a.stars)

    console.log(
      `Successfully fetched details for ${repositories.length} repositories`
    )

    // Write to JSON file using Bun's native file writing
    const outputPath = './viem_repositories.json'
    await Bun.write(outputPath, JSON.stringify(repositories, null, 2))

    console.log(
      `✓ Successfully exported ${repositories.length} repositories to ${outputPath}`
    )
    console.log(`\nTop 5 repositories by stars:`)
    repositories.slice(0, 5).forEach((repo, index) => {
      console.log(`${index + 1}. ${repo.full_name} - ${repo.stars} ⭐`)
    })
  } catch (error) {
    console.error('Error fetching repositories:', error)
    process.exit(1)
  }
}

// Run the search
searchViemRepos()
