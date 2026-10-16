import { accountRpc } from './account-rpc';
import { checkpoint } from './checkpoint';
import { trackedTv } from './library';
import type { State } from './types';
import { currentPushToken } from './push';
import { sb, hasAuth } from './supabase';
/** Ownership comes from the authenticated session, never a user ID in the request body. */
export async function syncDevice(s: State, device: string, _force = false): Promise<boolean> {
  try {
    const client = sb();
    if (!client) return false;
    const {data:{session}} = await client.auth.getSession();
    if (!session) return false;
    if ((await checkpoint.load()).meta.uid !== session.user.id) return false;
    const token = await currentPushToken();
    if (!token) return false;
    await accountRpc('register_native_device_v2', {p_id:device,p_token:token,p_follow:s.follow,p_tv:trackedTv(s)},session.user.id);
    return true;
  } catch { return false; }
}
export const hasSyncApi = hasAuth;
