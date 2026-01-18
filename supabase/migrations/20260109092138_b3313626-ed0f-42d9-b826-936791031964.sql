-- Drop old restrictive policies for voiceovers
DROP POLICY IF EXISTS "Allow all operations on voiceovers" ON public.voiceovers;

-- Create new permissive policy
CREATE POLICY "Allow all operations on voiceovers"
ON public.voiceovers
FOR ALL
USING (true)
WITH CHECK (true);