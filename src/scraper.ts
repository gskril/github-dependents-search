import * as cheerio from 'cheerio'

interface DependentRepo {
  name: string
  full_name: string
  description: string | null
  stars: number
  url: string
  language: string | null
}

async function scrapeGitHubDependents(
  owner: string,
  repo: string,
  maxPages: number = Infinity
): Promise<DependentRepo[]> {
  const baseUrl = `https://github.com/${owner}/${repo}/network/dependents`
  const repositories: DependentRepo[] = []
  let currentPage = 1
  let nextPageUrl: string | null = baseUrl

  console.log(`Starting to scrape dependents for ${owner}/${repo}...`)

  while (currentPage <= maxPages && nextPageUrl) {
    try {
      console.log(`\nFetching page ${currentPage}...`)
      console.log(`URL: ${nextPageUrl}`)

      // Fetch the HTML
      const response = await fetch(nextPageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
      })

      if (!response.ok) {
        console.error(`Failed to fetch page ${currentPage}: ${response.status}`)
        break
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Parse repository boxes
      const repoBoxes = $('#dependents .Box .Box-row')
      console.log(`Found ${repoBoxes.length} repositories on this page`)

      if (repoBoxes.length === 0) {
        console.log('No more repositories found. Stopping.')
        break
      }

      repoBoxes.each((index, element) => {
        try {
          const $box = $(element)

          // Extract repository link and name
          const repoLink = $box
            .find('a[data-hovercard-type="repository"]')
            .first()
          const fullName = repoLink.attr('href')?.replace('/', '').trim() || ''
          const url = fullName ? `https://github.com/${fullName}` : ''

          // Extract description
          const description = $box.find('span.px-1').text().trim() || null

          // Extract stars
          const starsText = $box.find('svg.octicon-star').parent().text().trim()
          const stars = parseStarCount(starsText)

          // Extract language
          const languageSpan = $box.find('span[itemprop="programmingLanguage"]')
          const language = languageSpan.text().trim() || null

          if (fullName) {
            const [owner, name] = fullName.split('/')
            repositories.push({
              name: name || fullName,
              full_name: fullName,
              description,
              stars,
              url,
              language,
            })
          }
        } catch (err) {
          console.error(`Error parsing repository at index ${index}:`, err)
        }
      })

      console.log(`Total repositories collected so far: ${repositories.length}`)

      // Extract the next page URL from the "Next" button
      const nextButton = $('a.BtnGroup-item:contains("Next")')
      const nextHref = nextButton.attr('href')

      if (!nextHref || nextButton.hasClass('disabled')) {
        console.log('No more pages available.')
        nextPageUrl = null
        break
      }

      // Construct full URL (href might be relative)
      nextPageUrl = nextHref.startsWith('http')
        ? nextHref
        : `https://github.com${nextHref}`

      currentPage++

      // Be respectful with rate limiting
      const delay = 2000 + Math.random() * 1000 // 2-3 seconds
      console.log(
        `Waiting ${(delay / 1000).toFixed(1)}s before next request...`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error)
      break
    }
  }

  // Sort by stars (descending)
  repositories.sort((a, b) => b.stars - a.stars)

  return repositories
}

function parseStarCount(starsText: string): number {
  const cleaned = starsText.replace(/[,\s]/g, '')

  // Handle k/m notation (e.g., "1.2k" or "5m")
  if (cleaned.toLowerCase().includes('k')) {
    return Math.round(parseFloat(cleaned) * 1000)
  }
  if (cleaned.toLowerCase().includes('m')) {
    return Math.round(parseFloat(cleaned) * 1000000)
  }

  const parsed = parseInt(cleaned, 10)
  return isNaN(parsed) ? 0 : parsed
}

// Main execution
async function main() {
  const owner = 'wevm'
  const repo = 'viem'
  const maxPages = undefined

  console.log(`
╔═══════════════════════════════════════════════════════╗
║     GitHub Dependents Scraper                         ║
║     Scraping: ${owner}/${repo}                           ║
╚═══════════════════════════════════════════════════════╝
  `)

  const repositories = await scrapeGitHubDependents(owner, repo, maxPages)

  console.log(`\n✓ Successfully scraped ${repositories.length} repositories`)

  // Write to JSON file
  const outputPath = './viem_dependents_scraped.json'
  await Bun.write(outputPath, JSON.stringify(repositories, null, 2))

  console.log(`✓ Saved results to ${outputPath}`)

  // Show top 10
  console.log(`\n📊 Top 10 repositories by stars:`)
  repositories.slice(0, 10).forEach((repo, index) => {
    console.log(
      `${index + 1}. ${repo.full_name.padEnd(40)} ${repo.stars
        .toLocaleString()
        .padStart(7)} ⭐ ${repo.language || 'N/A'}`
    )
  })

  console.log(`\n📈 Statistics:`)
  console.log(`   Total repositories: ${repositories.length.toLocaleString()}`)
  console.log(
    `   Total stars: ${repositories
      .reduce((sum, r) => sum + r.stars, 0)
      .toLocaleString()}`
  )
  console.log(
    `   Average stars: ${Math.round(
      repositories.reduce((sum, r) => sum + r.stars, 0) / repositories.length
    ).toLocaleString()}`
  )

  const languages = repositories
    .filter((r) => r.language)
    .reduce((acc, r) => {
      acc[r.language!] = (acc[r.language!] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  console.log(`\n🔤 Top languages:`)
  Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([lang, count]) => {
      console.log(`   ${lang}: ${count}`)
    })
}

main()
