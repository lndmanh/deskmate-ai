export interface MascotChatRequest {
  message: string
  history?: MascotChatHistoryMessage[]
}

export interface MascotChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface MascotChatResponse {
  message: string
  motion: string
  createdAt: string
}

export interface MascotChatContext {
  activeTime?: string | null
  longestSession?: string | null
  currentSessionMinutes?: number | null
  breakCount?: number | null
  extraEvents?: string[]
}

export interface DeskMateChatApiResponse {
  answer: string
  used_llm: boolean
  retrieved_documents: DeskMateRetrievedDocument[]
}

export interface DeskMateRetrievedDocument {
  source: string
  title: string
  content: string
  score: number
}
