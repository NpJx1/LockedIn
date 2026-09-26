const BLOCKED_SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'fb.watch',
  'messenger.com',
  'threads.net',
  'threads.com',
  'twitter.com',
  'x.com',
  't.co',
  'tiktok.com',
  'snapchat.com',
  'reddit.com',
  'redd.it',
  'linkedin.com',
  'pinterest.com',
  'pin.it',
  'tumblr.com',
  'discord.com',
  'discord.gg',
  'whatsapp.com',
  'web.whatsapp.com',
  'telegram.org',
  't.me',
  'vk.com',
  'bsky.app',
  'truthsocial.com',
  'nextdoor.com',
  'quora.com',
  'mastodon.social',
  'weibo.com',
  'twitch.tv'
]

const ALLOWED_MUSIC_AND_VIDEO_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'music.youtube.com',
  'spotify.com',
  'soundcloud.com',
  'bandcamp.com',
  'music.apple.com',
  'itunes.apple.com',
  'tidal.com',
  'deezer.com',
  'pandora.com',
  'music.amazon.com',
  'music.amazon.co.uk',
  'musicbrainz.org',
  'mixcloud.com',
  'audius.co'
]

function hostnameFrom(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function hostMatchesDomain(host: string, domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '')
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`)
}

export function isAllowedMusicOrVideoUrl(url: string): boolean {
  const host = hostnameFrom(url)
  if (!host) return false
  return ALLOWED_MUSIC_AND_VIDEO_DOMAINS.some((domain) => hostMatchesDomain(host, domain))
}

export function isBlockedSocialUrl(url: string): boolean {
  if (isAllowedMusicOrVideoUrl(url)) return false
  const host = hostnameFrom(url)
  if (!host) return false
  return BLOCKED_SOCIAL_DOMAINS.some((domain) => hostMatchesDomain(host, domain))
}

export function getBlockedPageUrl(): string {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Blocked</title>
    <style>
      html, body { height: 100%; margin: 0; background: #0a0a0a; color: #fff; font-family: Inter, system-ui, sans-serif; }
      .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
      h1 { font-size: 1.4rem; letter-spacing: 0.12em; text-transform: uppercase; color: #ef4444; }
      p { color: #888; max-width: 420px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Locked In</h1>
      <p>That site is blocked while you work. YouTube, Spotify, and other music apps are still allowed.</p>
    </div>
  </body>
</html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

export const DEFAULT_TAB_URL = 'https://www.google.com'
