-- Create table for cam upload metadata
CREATE TABLE public.cam_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  ip_hint text
);

-- Allow anonymous inserts (public tracking, no auth required)
ALTER TABLE public.cam_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert cam uploads"
  ON public.cam_uploads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read cam uploads"
  ON public.cam_uploads FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create storage bucket for cam files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cam-files', 'cam-files', false, 104857600, ARRAY['application/octet-stream']);

-- Allow anonymous uploads to cam-files bucket
CREATE POLICY "Anyone can upload cam files"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'cam-files');