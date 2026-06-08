import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DjSet = {
  id: string;
  user_id: string;
  set_date: string;
  venue: string;
  amount_sek: number;
  duration_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function useDjSets() {
  return useQuery({
    queryKey: ["dj_sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dj_sets")
        .select("*")
        .order("set_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DjSet[];
    },
  });
}

export function useUpsertDjSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      set_date: string;
      venue: string;
      amount_sek: number;
      duration_hours?: number | null;
      notes?: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      if (input.id) {
        const { error } = await supabase
          .from("dj_sets")
          .update({
            set_date: input.set_date,
            venue: input.venue,
            amount_sek: input.amount_sek,
            duration_hours: input.duration_hours ?? null,
            notes: input.notes ?? null,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dj_sets").insert({
          user_id: u.user.id,
          set_date: input.set_date,
          venue: input.venue,
          amount_sek: input.amount_sek,
          duration_hours: input.duration_hours ?? null,
          notes: input.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dj_sets"] }),
  });
}

export function useDeleteDjSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dj_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dj_sets"] }),
  });
}
