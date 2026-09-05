import { apiClient } from "./client";
import { reportSchema } from "@edem/contracts";
import type { CreateReportDto, Report } from "@edem/contracts";
import { z } from "zod";

const reportsSchema = z.array(reportSchema);

export const reportsApi = {
  create: (data: CreateReportDto): Promise<Report> =>
    apiClient.request("/reports", { method: "POST", body: JSON.stringify(data) }, reportSchema),
  listMine: (signal?: AbortSignal): Promise<Report[]> =>
    apiClient.request("/reports", { signal }, reportsSchema),
};
