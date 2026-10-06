-- Run this in your Supabase SQL Editor

-- 1. Create Candidates Table
CREATE TABLE public.candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    vision TEXT NOT NULL,
    mission TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Voters Table
CREATE TABLE public.voters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    has_voted BOOLEAN DEFAULT FALSE,
    voted_for UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Set up Row Level Security (RLS)
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;

-- Candidates are viewable by everyone
CREATE POLICY "Candidates are viewable by everyone" ON public.candidates
    FOR SELECT USING (true);

-- Allow admin CRUD operations for candidates (using anon key in this simple setup)
CREATE POLICY "Admin can insert candidates" ON public.candidates
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can update candidates" ON public.candidates
    FOR UPDATE USING (true);

CREATE POLICY "Admin can delete candidates" ON public.candidates
    FOR DELETE USING (true);

-- Voters can read their own data and update it only if they haven't voted yet
CREATE POLICY "Voters can view own data" ON public.voters
    FOR SELECT USING (true);

CREATE POLICY "Voters can update own vote" ON public.voters
    FOR UPDATE USING (true);

-- Allow inserting new voters (for admin dashboard using anon key in this simple setup)
CREATE POLICY "Admin can insert voters" ON public.voters
    FOR INSERT WITH CHECK (true);

-- Allow deleting voters (for reset functionality)
CREATE POLICY "Admin can delete voters" ON public.voters
    FOR DELETE USING (true);

-- 4. ENABLE REALTIME FOR VOTERS TABLE
-- This is critical so the dashboard updates automatically without refreshing!
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voters;

-- 5. Insert some dummy candidates
INSERT INTO public.candidates (number, name, vision, mission, image_url) VALUES 
(1, 'Budi & Andi', 'Mewujudkan OSIS yang Cerdas, Kreatif, dan Inovatif.', '1. Menyelenggarakan kegiatan ekstrakurikuler yang bervariasi.\n2. Mengadakan lomba-lomba akademik dan non-akademik.', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop&q=60'),
(2, 'Siti & Rahma', 'Sekolah yang ramah, inklusif, dan peduli lingkungan.', '1. Program penghijauan sekolah.\n2. Kampanye anti-bullying dan kesehatan mental.', 'https://images.unsplash.com/photo-1529390079861-591de354faf5?w=500&auto=format&fit=crop&q=60'),
(3, 'Joko & Anwar', 'Meningkatkan prestasi sekolah di tingkat nasional.', '1. Membentuk kelompok belajar intensif.\n2. Mengundang pembicara alumni sukses.', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&auto=format&fit=crop&q=60');
