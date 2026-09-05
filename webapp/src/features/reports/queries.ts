import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminReportsQuery, UpdateReportStatusDto } from "@edem/contracts";
import { fetchReports, updateReportStatus } from "./api";

export function useReportsQuery(params: AdminReportsQuery) {
  return useQuery({ queryKey: ["admin", "reports", params], queryFn: () => fetchReports(params) });
}

export function useUpdateReportStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReportStatusDto }) => updateReportStatus(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
  });
}
