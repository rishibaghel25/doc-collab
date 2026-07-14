-- SQL Schema Setup for Supabase Database
-- Paste these queries directly into the Supabase SQL Editor to initialize the database tables.

-- 1. Create Profiles Table (Simulated Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT,                          -- SHA-256 hex of user's password
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add password_hash to existing databases
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Enable Row Level Security (RLS) - optional, but standard
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow all reads/writes for simplicity in demo
CREATE POLICY "Allow open read access to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow open write access to profiles" ON public.profiles FOR ALL USING (true);


-- 2. Create Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow open read/write for standard demo (application handles permission logic)
CREATE POLICY "Allow open access to documents" ON public.documents FOR ALL USING (true);


-- 3. Create Shares Table (Collaborators)
CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('VIEW', 'EDIT')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (document_id, user_id)
);

-- Enable RLS
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Allow open access for simplicity
CREATE POLICY "Allow open access to shares" ON public.shares FOR ALL USING (true);


-- 4. Seed Mock Profiles - Removed for production-like deploy

-- 5. Document Version History
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow open access to document_versions" ON public.document_versions FOR ALL USING (true);
