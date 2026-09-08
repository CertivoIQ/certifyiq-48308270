import { useQuery } from '@tanstack/react-query';
import { useSession } from './use-session';
import { supabase } from '@/integrations/supabase/client';

export function useEnterpriseBillingAuthority() {
  const { user } = useSession();
  return useQuery({ queryKey: ['enterprise-billing-authority',user?.id], enabled: !!user, staleTime: 60_000, queryFn: async () => {
    const { data,error } = await supabase.from('enterprise_license_members').select('license_id').eq('user_id',user!.id).eq('role','admin').limit(1);
    if(error) throw error;
    return !!data?.length;
  }});
}
