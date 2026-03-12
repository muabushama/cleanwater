import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'غير مصرح' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'غير مصرح' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Check admin role
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin');
  if (!roleData || roleData.length === 0) {
    return new Response(JSON.stringify({ error: 'صلاحيات المدير مطلوبة' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { action, password, newPassword } = body;

  // ===== EXPORT ALL DATA =====
  if (action === 'export') {
    const tables = ['customers', 'customer_devices', 'candle_changes', 'installments', 'invoices', 'maintenance', 'products', 'work_orders', 'profiles', 'rep_locations'];
    const data: Record<string, any> = {};

    for (const table of tables) {
      const { data: tableData, error } = await supabaseAdmin.from(table).select('*');
      if (error) {
        data[table] = { error: error.message };
      } else {
        data[table] = tableData || [];
      }
    }

    return new Response(JSON.stringify({
      data,
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      total_records: Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ===== DELETE ALL DATA =====
  if (action === 'delete-all') {
    if (!password) {
      return new Response(JSON.stringify({ error: 'كلمة السر مطلوبة' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate password
    const { data: settings } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'delete_password').single();
    if (!settings || settings.value !== password) {
      return new Response(JSON.stringify({ error: 'كلمة السر غير صحيحة' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Delete from all tables in correct order (respecting foreign keys)
    const deleteOrder = [
      'candle_changes',
      'installments',
      'invoices',
      'maintenance',
      'work_orders',
      'customer_devices',
      'customers',
      'rep_locations',
    ];

    const results: Record<string, string> = {};
    for (const table of deleteOrder) {
      const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      results[table] = error ? error.message : 'deleted';
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'تم مسح جميع البيانات بنجاح',
      details: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ===== CHANGE PASSWORD =====
  if (action === 'change-password') {
    if (!password || !newPassword) {
      return new Response(JSON.stringify({ error: 'كلمة السر الحالية والجديدة مطلوبة' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate old password
    const { data: settings } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'delete_password').single();
    if (!settings || settings.value !== password) {
      return new Response(JSON.stringify({ error: 'كلمة السر الحالية غير صحيحة' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update password
    const { error } = await supabaseAdmin.from('system_settings').update({
      value: newPassword,
      updated_at: new Date().toISOString(),
    }).eq('key', 'delete_password');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'تم تغيير كلمة السر بنجاح',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
