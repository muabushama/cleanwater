import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, password, full_name, branch_id } = await req.json();

    if (action === 'setup_admin') {
      // Create admin user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Update profile
      await supabase.from('profiles').update({
        full_name,
        branch_id: branch_id || '1',
      }).eq('id', userId);

      // Assign admin role
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'admin',
      });

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_rep') {
      // Verify caller is admin
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Unauthorized');

      const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) throw new Error('Unauthorized');

      // Check if caller is admin
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'admin').maybeSingle();
      if (!roleData) throw new Error('Only admins can create reps');

      // Create rep user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      await supabase.from('profiles').update({
        full_name,
        branch_id: branch_id || '1',
      }).eq('id', userId);

      await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'sales_rep',
      });

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
