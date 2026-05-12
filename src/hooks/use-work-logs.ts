import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WorkLog = {
  id: string;
  user_id: string;
  calendar_id: string;
  work_date: string;
  hours: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export function useWorkLogs() {
  return useQuery({
    queryKey: ["work_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs")
        .select("*")
        .order("work_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkLog[];
    },
  });
}

export function useUpsertWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { calendar_id: string; work_date: string; hours: number; note?: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      if (input.hours <= 0) {
        const { error } = await supabase
          .from("work_logs")
          .delete()
          .eq("user_id", u.user.id)
          .eq("calendar_id", input.calendar_id)
          .eq("work_date", input.work_date);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("work_logs")
        .upsert(
          {
            user_id: u.user.id,
            calendar_id: input.calendar_id,
            work_date: input.work_date,
            hours: input.hours,
            note: input.note ?? null,
          },
          { onConflict: "user_id,calendar_id,work_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work_logs"] }),
  });
}
