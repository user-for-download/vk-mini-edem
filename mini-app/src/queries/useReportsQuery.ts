import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateReportDto } from "@edem/contracts";
import { reportsApi } from "@/api/reports.api";

export function useMyReportsQuery(enabled = true) {
  return useQuery({ queryKey: ["reports", "mine"], queryFn: ({ signal }) => reportsApi.listMine(signal), enabled, staleTime: 30_000 });
}

export function useCreateReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (data: CreateReportDto) => reportsApi.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports", "mine"] }) });
}
