import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthSession, AuthUser } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRep, setIsRep] = useState(false);
  const [isCustomerService, setIsCustomerService] = useState(false);
  const [isWarehouseKeeper, setIsWarehouseKeeper] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; branch_id: string } | null>(null);

  useEffect(() => {
    const loadSessionState = async (nextSession: AuthSession | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const [profileRes, adminRes, repRes, csRes, wkRes] = await Promise.all([
          supabase.from('profiles').select('full_name, branch_id').eq('id', nextSession.user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', nextSession.user.id).eq('role', 'admin').maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', nextSession.user.id).eq('role', 'sales_rep').maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', nextSession.user.id).eq('role', 'customer_service').maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', nextSession.user.id).eq('role', 'warehouse_keeper').maybeSingle(),
        ]);
        if (profileRes.data) setProfile(profileRes.data);
        setIsAdmin(!!adminRes.data);
        setIsRep(!!repRes.data);
        setIsCustomerService(!!csRes.data);
        setIsWarehouseKeeper(!!wkRes.data);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsRep(false);
        setIsCustomerService(false);
        setIsWarehouseKeeper(false);
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await loadSessionState(nextSession);
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      await loadSessionState(initialSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'admin' | 'sales_rep' | 'customer_service' | 'warehouse_keeper',
    branchId: string,
    phone?: string,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, branch_id: branchId, phone } },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return { user, session, loading, isAdmin, isRep, isCustomerService, isWarehouseKeeper, profile, signIn, signUp, signOut };
}
