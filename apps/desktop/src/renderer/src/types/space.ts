export interface SpaceCreatorSocialLinks {
  tiktok: string
  youtube: string
  instagram: string
  tips: string
  other: string
  spotify?: string
}

export interface Space {
  id: string
  name: string
  category: string
  recommendation: number
  videoUrl: string
  thumbnailUrl?: string
  isProdReady?: boolean
  removed: boolean
  creatorName: string
  creatorAviUrl: string
  creatorSocialLinks: SpaceCreatorSocialLinks
  isPremium: boolean
  featured: boolean
}

export interface SpacesFile {
  spaces: Space[]
  activeCategories: string[]
}
