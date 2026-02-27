// Entity types matching data-model.md

export interface Session {
  id: string
  status: 'active' | 'ended'
  current_slide: number
  presenter_token_hash: string
  created_at: string
  ended_at: string | null
}

export interface Poll {
  id: string
  session_id: string
  slide_number: number
  question: string
  options: string[]
  status: 'open' | 'closed'
  created_at: string
}

export interface PollVote {
  id: string
  poll_id: string
  device_id: string
  selected_option: number
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  session_id: string
  device_id: string
  content: string
  score: number
  is_answered: boolean
  is_hidden: boolean
  created_at: string
}

export interface QuestionVote {
  id: string
  question_id: string
  device_id: string
  direction: 1 | -1
  created_at: string
}

// API request types

export interface CreateSessionRequest {
  polls: Array<{
    slide_number: number
    question: string
    options: string[]
  }>
}

export interface CreateSessionResponse {
  session: Pick<Session, 'id' | 'status' | 'current_slide' | 'created_at'>
  polls: Array<Pick<Poll, 'id' | 'slide_number' | 'question' | 'options' | 'status'>>
}

export interface EndSessionResponse {
  session: Pick<Session, 'id' | 'status' | 'ended_at'>
}

export interface ResetSessionResponse {
  session: Pick<Session, 'id' | 'status' | 'current_slide'>
  cleared: {
    poll_votes: number
    questions: number
    question_votes: number
  }
}

export interface SyncSlideRequest {
  slide_number: number
}

export interface SyncSlideResponse {
  slide_number: number
  poll: Pick<Poll, 'id' | 'question' | 'options' | 'status'> | null
}

export interface SubmitVoteRequest {
  poll_id: string
  device_id: string
  selected_option: number
}

export interface SubmitVoteResponse {
  vote: {
    poll_id: string
    selected_option: number
    changed: boolean
  }
}

export interface SubmitQuestionRequest {
  session_id: string
  device_id: string
  content: string
}

export interface SubmitQuestionResponse {
  question: Pick<Question, 'id' | 'content' | 'score' | 'created_at'>
}

export interface VoteQuestionRequest {
  question_id: string
  device_id: string
  direction: 1 | -1
}

export interface VoteQuestionResponse {
  vote: {
    question_id: string
    direction: 1 | -1
    action: 'created' | 'changed' | 'removed'
  }
  question: {
    id: string
    score: number
  }
}

export interface ManagePollRequest {
  poll_id: string
  action: 'open' | 'close'
}

export interface ManagePollResponse {
  poll: Pick<Poll, 'id' | 'status'>
}

export interface ManageQuestionRequest {
  question_id: string
  action: 'answer' | 'unanswer' | 'hide' | 'unhide'
}

export interface ManageQuestionResponse {
  question: {
    id: string
    is_answered: boolean
    is_hidden: boolean
  }
}

export interface ErrorResponse {
  error: string
}

// Poll configuration type
export interface PollConfig {
  slideNumber: number
  question: string
  options: string[]
}
