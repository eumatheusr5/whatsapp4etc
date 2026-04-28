import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { getSupabaseAdmin } from '../lib/supabase-admin';
import { logger } from '../lib/logger';

interface KeyStore {
  [type: string]: { [id: string]: unknown };
}

/**
 * Implementação custom de auth state para Baileys que persiste creds + keys
 * na tabela public.instance_auth_state do Supabase.
 *
 * Substitui o useMultiFileAuthState padrão. Permite que ao reiniciar o
 * servidor (Render), as sessões sejam recarregadas SEM novo QR code.
 */
export async function useSupabaseAuthState(instanceId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clear: () => Promise<void>;
}> {
  const supabase = getSupabaseAdmin();

  const loadStored = async (): Promise<{ creds: AuthenticationCreds; keys: KeyStore }> => {
    const { data, error } = await supabase
      .from('instance_auth_state')
      .select('creds, keys')
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (error) {
      logger.error({ err: error, instanceId }, 'falha ao ler instance_auth_state');
      throw error;
    }

    if (!data || !data.creds || Object.keys(data.creds as object).length === 0) {
      const fresh = initAuthCreds();
      return { creds: fresh, keys: {} };
    }

    const creds = JSON.parse(JSON.stringify(data.creds), BufferJSON.reviver) as AuthenticationCreds;
    const keys = JSON.parse(JSON.stringify(data.keys ?? {}), BufferJSON.reviver) as KeyStore;
    return { creds, keys };
  };

  let { creds, keys } = await loadStored();

  const persist = async (next: { creds?: AuthenticationCreds; keys?: KeyStore }): Promise<void> => {
    const payload: Record<string, unknown> = {
      instance_id: instanceId,
      updated_at: new Date().toISOString(),
    };
    if (next.creds) {
      payload.creds = JSON.parse(JSON.stringify(next.creds, BufferJSON.replacer));
    }
    if (next.keys) {
      payload.keys = JSON.parse(JSON.stringify(next.keys, BufferJSON.replacer));
    }
    const { error } = await supabase
      .from('instance_auth_state')
      .upsert(payload as never, { onConflict: 'instance_id' });
    if (error) logger.error({ err: error, instanceId }, 'falha ao persistir auth state');
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const out: { [id: string]: SignalDataTypeMap[typeof type] } = {} as never;
        const bucket = (keys[type] ?? {}) as Record<string, unknown>;
        for (const id of ids) {
          let value = bucket[id];
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value as never);
          }
          if (value) out[id] = value as SignalDataTypeMap[typeof type];
        }
        return out;
      },
      set: async (data) => {
        for (const [type, byId] of Object.entries(data)) {
          if (!keys[type]) keys[type] = {};
          const target = keys[type] as Record<string, unknown>;
          for (const [id, value] of Object.entries(byId ?? {})) {
            if (value === null || value === undefined) {
              delete target[id];
            } else {
              target[id] = value;
            }
          }
        }
        await persist({ keys });
      },
    },
  };

  return {
    state,
    saveCreds: async () => {
      await persist({ creds: state.creds });
    },
    clear: async () => {
      const { error } = await supabase
        .from('instance_auth_state')
        .delete()
        .eq('instance_id', instanceId);
      if (error) logger.error({ err: error, instanceId }, 'falha ao limpar auth state');
      keys = {};
    },
  };
}
