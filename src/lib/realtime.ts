import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeTable<T>(
  table: string,
  filter?: string,
  callback?: (payload: unknown) => void
) {
  const [data, setData] = useState<T[]>([]);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let channel = supabase.channel(`${table}-realtime`);

    if (filter) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => cbRef.current?.(payload)
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => cbRef.current?.(payload)
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);

  return { data, setData };
}

export function usePresence(roomName: string, userId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(roomName, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineUsers(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName, userId]);

  return onlineUsers;
}
