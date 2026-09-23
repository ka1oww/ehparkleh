import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'
import robots from '../public/robots.txt?raw'
import sitemap from '../public/sitemap.xml?raw'

// Search engines index what index.html serves before any JavaScript runs.
// These checks pin the crawlable surface: the About copy and the JSON-LD
// must live in the static HTML, not be rendered by React into #root.
describe('crawlable landing content', () => {
  it('serves the About section as static HTML outside #root', () => {
    const rootAt = html.indexOf('<div id="root">')
    const aboutAt = html.indexOf('<section id="ehparkleh-about"')
    expect(rootAt).toBeGreaterThan(-1)
    expect(aboutAt).toBeGreaterThan(rootAt)

    const about = html.slice(aboutAt, html.indexOf('</section>', aboutAt))
    expect(about).toMatch(/<h1>EhParkLeh: find parking near you in Singapore<\/h1>/)
    const h2s = [...about.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1])
    expect(h2s).toEqual([
      'Live carpark availability',
      'HDB, mall, street, and private parking',
      'Rates and free Sunday parking',
      'EV charging',
      'What EhParkLeh does not do',
    ])
  })

  it('embeds valid schema.org JSON-LD for the app', () => {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(match).not.toBeNull()
    const ld = JSON.parse(match![1]) as Record<string, unknown>
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('WebApplication')
    expect(ld.name).toBe('EhParkLeh')
    expect(ld.url).toBe('https://ehparkleh.vercel.app/')
    expect(ld.isAccessibleForFree).toBe(true)
  })

  it('keeps canonical URL, robots, and sitemap aligned', () => {
    expect(html).toContain('<link rel="canonical" href="https://ehparkleh.vercel.app/" />')
    expect(robots).toMatch(/^Allow: \/$/m)
    expect(robots).toContain('Sitemap: https://ehparkleh.vercel.app/sitemap.xml')
    expect(sitemap).toContain('<loc>https://ehparkleh.vercel.app/</loc>')
  })
})
