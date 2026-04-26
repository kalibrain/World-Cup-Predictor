-- The 'share' step was removed from the app. Rewrite any leftover rows so
-- current_step / furthest_step only contain values that match the AppStep union.
update public.brackets set current_step = 'bracket' where current_step = 'share';
update public.brackets set furthest_step = 'bracket' where furthest_step = 'share';
