import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { useReportsQuery, useUpdateReportStatusMutation } from "./queries";

export function ReportsPage() {
  const [status, setStatus] = useState<"pending" | "in_review" | "resolved" | "rejected" | undefined>("pending");
  const [page, setPage] = useState(1);
  const query = useReportsQuery({ status, page, pageSize: 20 });
  const mutation = useUpdateReportStatusMutation();
  const [note, setNote] = useState<Record<string, string>>({});

  return <section className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Жалобы</h1><select className="rounded-md border bg-background px-3 py-2 text-sm" value={status ?? "all"} onChange={(event) => { setPage(1); setStatus(event.target.value === "all" ? undefined : event.target.value as typeof status); }}><option value="all">Все</option><option value="pending">Новые</option><option value="in_review">В работе</option><option value="resolved">Решённые</option><option value="rejected">Отклонённые</option></select></div>
    {query.isPending && <p>Загрузка...</p>}
    {query.isError && <p className="text-destructive">{query.error.message}</p>}
    {query.data?.items.length === 0 && <p className="text-muted-foreground">Жалоб нет</p>}
    <div className="grid gap-3">{query.data?.items.map((report) => <article key={report.id} className="grid gap-3 rounded-lg border p-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{report.status}</Badge><Badge variant="secondary">{report.category}</Badge><span className="text-sm text-muted-foreground">{report.targetType} · {report.reporterName} · {formatDateTime(report.createdAt)}</span></div><p className="whitespace-pre-wrap text-sm">{report.description}</p>{report.status !== "resolved" && report.status !== "rejected" && <><Textarea placeholder="Комментарий модератора" value={note[report.id] ?? ""} onChange={(event) => setNote((current) => ({ ...current, [report.id]: event.target.value }))} /><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: report.id, data: { status: "in_review", resolutionNote: note[report.id] } })}>В работу</Button><Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: report.id, data: { status: "resolved", resolutionNote: note[report.id] } })}>Решить</Button><Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: report.id, data: { status: "rejected", resolutionNote: note[report.id] } })}>Отклонить</Button></div></>}</article>)}</div>
    {query.data && <div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Назад</Button><span className="px-2 py-2 text-sm">Страница {page} из {Math.max(1, query.data.pagination.totalPages)}</span><Button variant="outline" disabled={!query.data.pagination.hasMore} onClick={() => setPage((current) => current + 1)}>Вперёд</Button></div>}
  </section>;
}
