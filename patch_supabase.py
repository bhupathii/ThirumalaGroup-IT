import re

with open('src/lib/supabaseFinance.ts', 'r') as f:
    content = f.read()

# Add to the supabaseFinance object
methods = """  // Settings
  async getFinanceSettings(key: string): Promise<any> {
    const { data, error } = await supabase
      .from('finance_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.warn('Error fetching setting', key, error);
    }
    return data?.setting_value || null;
  },

  async saveFinanceSettings(key: string, value: any): Promise<void> {
    const { error } = await supabase
      .from('finance_settings')
      .upsert({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    if (error) throw error;
  },

  // Guarantors"""

content = content.replace("  // Guarantors", methods)

with open('src/lib/supabaseFinance.ts', 'w') as f:
    f.write(content)
