export type ProjectStatus = 'draft' | 'pending_review' | 'in_revision' | 'approved'
export type VideoStatus = 'pending' | 'approved' | 'rejected'
export type FeedbackType = 'memo' | 'correction'

export interface Project {
  id: string
  name: string
  client_name: string
  deadline: string | null
  status: ProjectStatus
  share_token: string
  share_expires_at: string | null
  user_id: string
  created_at: string
  updated_at: string
  videos?: Video[]
}

export interface Video {
  id: string
  project_id: string
  title: string
  storage_path: string
  duration: number | null
  display_order: number
  status: VideoStatus
  rejection_reason: string | null
  created_at: string
  updated_at: string
  feedbacks?: Feedback[]
}

export interface Feedback {
  id: string
  video_id: string
  type: FeedbackType
  timestamp_seconds: number
  text: string
  author_name: string | null
  is_resolved: boolean
  created_at: string
  updated_at: string
  replies?: FeedbackReply[]
}

export interface FeedbackReply {
  id: string
  feedback_id: string
  text: string
  author_name: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: Project
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'share_token'>
        Update: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>
      }
      videos: {
        Row: Video
        Insert: Omit<Video, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Video, 'id' | 'created_at' | 'updated_at'>>
      }
      feedbacks: {
        Row: Feedback
        Insert: Omit<Feedback, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Feedback, 'id' | 'created_at' | 'updated_at'>>
      }
      feedback_replies: {
        Row: FeedbackReply
        Insert: Omit<FeedbackReply, 'id' | 'created_at'>
        Update: Partial<Omit<FeedbackReply, 'id' | 'created_at'>>
      }
    }
  }
}
