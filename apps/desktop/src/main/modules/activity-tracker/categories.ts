import { basename } from 'path'
import type { ActiveWindowSample, AppCategory } from './types'

/**
 * Heuristic mapping from an application to a Work Rhythm category.
 *
 * Matching is intentionally simple and offline: we build a lowercased
 * haystack from the app name, bundle id and executable basename, then
 * look for known keywords. User-supplied overrides always win.
 */

interface CategoryRule {
  category: AppCategory
  keywords: string[]
}

const RULES: CategoryRule[] = [
  {
    category: 'coding',
    keywords: [
      'code',
      'vscode',
      'visual studio',
      'intellij',
      'webstorm',
      'pycharm',
      'phpstorm',
      'goland',
      'rubymine',
      'clion',
      'rider',
      'android studio',
      'xcode',
      'sublime',
      'sublime text',
      'atom',
      'neovim',
      'nvim',
      'vim',
      'emacs',
      'iterm',
      'terminal',
      'warp',
      'hyper',
      'tabby',
      'kitty',
      'alacritty',
      'wezterm',
      'konsole',
      'gnome-terminal',
      'powershell',
      'pwsh',
      'cmd',
      'windowsterminal',
      'fleet',
      'zed',
      'cursor',
      'docker',
      'postman',
      'insomnia',
      'datagrip',
      'tableplus',
      'sourcetree',
      'github desktop',
      'gitkraken'
    ]
  },
  {
    category: 'meeting',
    keywords: [
      'zoom',
      'webex',
      'gotomeeting',
      'bluejeans',
      'google meet',
      'whereby',
      'around'
    ]
  },
  {
    category: 'communication',
    keywords: [
      'slack',
      'discord',
      'mattermost',
      'telegram',
      'whatsapp',
      'messenger',
      'signal',
      'teams',
      'skype',
      'outlook',
      'mail',
      'thunderbird',
      'gmail',
      'spark',
      'zalo'
    ]
  },
  {
    category: 'writing',
    keywords: [
      'word',
      'pages',
      'notion',
      'obsidian',
      'bear',
      'typora',
      'onenote',
      'evernote',
      'google docs',
      'logseq',
      'craft',
      'ulysses',
      'scrivener',
      'ia writer'
    ]
  },
  {
    category: 'design',
    keywords: [
      'figma',
      'sketch',
      'photoshop',
      'illustrator',
      'indesign',
      'adobe xd',
      'affinity',
      'canva',
      'blender',
      'gimp',
      'inkscape',
      'lightroom',
      'premiere',
      'after effects',
      'davinci resolve'
    ]
  },
  {
    category: 'browsing',
    keywords: [
      'chrome',
      'chromium',
      'firefox',
      'safari',
      'edge',
      'brave',
      'opera',
      'vivaldi',
      'arc',
      'tor browser'
    ]
  },
  {
    category: 'support',
    keywords: [
      'zendesk',
      'freshdesk',
      'intercom',
      'jira',
      'servicenow',
      'helpscout',
      'front',
      'gorgias',
      'kustomer'
    ]
  },
  {
    category: 'media',
    keywords: [
      'spotify',
      'youtube',
      'netflix',
      'vlc',
      'music',
      'apple music',
      'quicktime',
      'twitch',
      'soundcloud',
      'podcast'
    ]
  },
  {
    category: 'productivity',
    keywords: [
      'excel',
      'numbers',
      'powerpoint',
      'keynote',
      'google sheets',
      'google slides',
      'trello',
      'asana',
      'clickup',
      'todoist',
      'things',
      'calendar',
      'fantastical',
      'linear',
      'monday'
    ]
  },
  {
    category: 'system',
    keywords: [
      'finder',
      'explorer',
      'system settings',
      'system preferences',
      'settings',
      'activity monitor',
      'task manager',
      'control panel',
      'installer',
      'loginwindow',
      'dock',
      'systemuiserver',
      'spotlight',
      'screenshot'
    ]
  }
]

function buildHaystack(sample: ActiveWindowSample): string {
  const parts = [sample.app, sample.bundleId ?? '', sample.path ? basename(sample.path) : '']
  return parts.join(' ').toLowerCase()
}

/**
 * Classify a window sample into a Work Rhythm category.
 *
 * @param overrides lowercased app name → category, takes precedence over rules.
 */
export function categorize(
  sample: ActiveWindowSample,
  overrides: Record<string, AppCategory> = {}
): AppCategory {
  const override = overrides[sample.app.toLowerCase()]
  if (override) {
    return override
  }

  const haystack = buildHaystack(sample)
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) {
        return rule.category
      }
    }
  }

  return 'other'
}
