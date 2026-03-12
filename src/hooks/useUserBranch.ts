import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';

export function useUserBranch() {
  const branchContext = useBranchContext();
  const [profileBranch, setProfileBranch] = useState<string>('فرع الإسكندرية');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBranch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', user.id).single();
        if (profile?.branch_id) {
          const branchMap: Record<string, string> = {
            '1': 'فرع الإسكندرية',
            '2': 'فرع الجيزة',
            'فرع الإسكندرية': 'فرع الإسكندرية',
            'فرع الجيزة': 'فرع الجيزة',
          };
          setProfileBranch(branchMap[profile.branch_id] || profile.branch_id);
        }
      }
      setLoading(false);
    };
    fetchBranch();
  }, []);

  // إذا تم اختيار فرع من القائمة (TopBar) نستخدمه، وإلا نستخدم فرع البروفايل
  const branch = branchContext?.branchName ?? profileBranch;

  return { branch, loading };
}
