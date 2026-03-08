-- VideoCheck Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  client_name text not null,
  deadline date,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'in_revision', 'approved')),
  share_token uuid unique default uuid_generate_v4(),
  share_expires_at timestamptz,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Videos table
create table videos (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  storage_path text not null,
  duration float,
  display_order int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Feedbacks table
create table feedbacks (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid not null references videos(id) on delete cascade,
  type text not null default 'memo' check (type in ('memo', 'correction')),
  timestamp_seconds float not null,
  text text not null,
  author_name text,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Feedback replies table
create table feedback_replies (
  id uuid primary key default uuid_generate_v4(),
  feedback_id uuid not null references feedbacks(id) on delete cascade,
  text text not null,
  author_name text,
  created_at timestamptz not null default now()
);

-- Updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach triggers
create trigger update_projects_updated_at
  before update on projects
  for each row execute function update_updated_at_column();

create trigger update_videos_updated_at
  before update on videos
  for each row execute function update_updated_at_column();

create trigger update_feedbacks_updated_at
  before update on feedbacks
  for each row execute function update_updated_at_column();

-- Row Level Security
alter table projects enable row level security;
alter table videos enable row level security;
alter table feedbacks enable row level security;
alter table feedback_replies enable row level security;

-- Projects: only owner can CRUD
create policy "Users can manage own projects"
  on projects for all
  using (auth.uid() = user_id);

-- Videos: owner can CRUD; share_token access is handled in API
create policy "Users can manage own project videos"
  on videos for all
  using (
    exists (
      select 1 from projects
      where projects.id = videos.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Feedbacks: owner can CRUD
create policy "Users can manage feedbacks on own videos"
  on feedbacks for all
  using (
    exists (
      select 1 from videos
      join projects on projects.id = videos.project_id
      where videos.id = feedbacks.video_id
      and projects.user_id = auth.uid()
    )
  );

-- Feedback replies: owner can CRUD
create policy "Users can manage replies on own feedbacks"
  on feedback_replies for all
  using (
    exists (
      select 1 from feedbacks
      join videos on videos.id = feedbacks.video_id
      join projects on projects.id = videos.project_id
      where feedbacks.id = feedback_replies.feedback_id
      and projects.user_id = auth.uid()
    )
  );

-- Service role bypass (for API routes using service key)
-- The API routes using the service role key bypass RLS

-- Indexes
create index on projects(user_id);
create index on projects(share_token);
create index on videos(project_id);
create index on feedbacks(video_id);
create index on feedbacks(timestamp_seconds);
create index on feedback_replies(feedback_id);
