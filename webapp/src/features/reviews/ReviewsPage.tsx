import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type {
  AdminPaginatedReviews,
  AdminReviewDto,
  ReviewStatusValue,
} from "@edem/contracts";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

import {
  useApproveReviewMutation,
  useDeleteReviewMutation,
  useRejectReviewMutation,
  useReviewsQuery,
} from "./queries";

const PAGE_SIZE = 10;

// Подписи статусов в таблице (ед. ч.) и в фильтре (мн. ч.) — разные по смыслу.
const STATUS_LABELS: Record<ReviewStatusValue, string> = {
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
};

const STATUS_FILTER_OPTIONS: { value: ReviewStatusValue; label: string }[] = [
  { value: "pending", label: "На модерации" },
  { value: "published", label: "Опубликованные" },
  { value: "rejected", label: "Отклонённые" },
];

type StatusFilterValue = ReviewStatusValue | "all";

export function ReviewsPage() {
  const [status, setStatus] = useState<StatusFilterValue>("all");
  const [page, setPage] = useState(1);
  const [reviewToDelete, setReviewToDelete] = useState<AdminReviewDto | null>(
    null
  );
  const reviewsQuery = useReviewsQuery({
    status: status === "all" ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  });
  const deleteMutation = useDeleteReviewMutation();

  const handleFilterChange = (next: StatusFilterValue) => {
    setStatus(next);
    setPage(1);
  };

  const confirmDelete = () => {
    if (!reviewToDelete) return;
    deleteMutation.mutate(reviewToDelete.id, {
      onSuccess: () => setReviewToDelete(null),
    });
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Отзывы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Модерация отзывов: одобрение, отклонение и фильтр по статусу.
          </p>
        </div>
        <StatusFilter value={status} onChange={handleFilterChange} />
      </div>
      {reviewsQuery.isPending && <ReviewsLoading />}
      {reviewsQuery.isError && (
        <ReviewsError
          message={reviewsQuery.error?.message ?? "Неизвестная ошибка"}
          onRetry={() => void reviewsQuery.refetch()}
        />
      )}
      {reviewsQuery.data && (
        <>
          <ReviewsTable
            reviews={reviewsQuery.data.items}
            onDelete={setReviewToDelete}
          />
          <ReviewsPagination
            data={reviewsQuery.data}
            page={page}
            onPageChange={setPage}
          />
        </>
      )}
      <DeleteReviewDialog
        review={reviewToDelete}
        isPending={deleteMutation.isPending}
        onClose={() => setReviewToDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as StatusFilterValue)}
    >
      <SelectTrigger aria-label="Фильтр по статусу" className="w-48">
        <SelectValue placeholder="Все" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Все</SelectItem>
        {STATUS_FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ReviewStatusBadge({ status }: { status: ReviewStatusValue }) {
  if (status === "pending") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      >
        {STATUS_LABELS.pending}
      </Badge>
    );
  }
  if (status === "published") {
    return (
      <Badge
        variant="secondary"
        className="bg-green-500/15 text-green-700 dark:text-green-400"
      >
        {STATUS_LABELS.published}
      </Badge>
    );
  }
  return <Badge variant="destructive">{STATUS_LABELS.rejected}</Badge>;
}

function ReviewsTable({
  reviews,
  onDelete,
}: {
  reviews: AdminReviewDto[];
  onDelete: (review: AdminReviewDto) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Автор</TableHead>
          <TableHead>Кому</TableHead>
          <TableHead>Оценка</TableHead>
          <TableHead>Текст</TableHead>
          <TableHead>Маршрут</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата</TableHead>
          <TableHead>Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="h-24 text-center text-muted-foreground"
            >
              Отзывов нет
            </TableCell>
          </TableRow>
        ) : (
          reviews.map((review) => (
            <ReviewRow key={review.id} review={review} onDelete={onDelete} />
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ReviewRow({
  review,
  onDelete,
}: {
  review: AdminReviewDto;
  onDelete: (review: AdminReviewDto) => void;
}) {
  const approveMutation = useApproveReviewMutation();
  const rejectMutation = useRejectReviewMutation();
  // Пока идёт одобрение/отклонение, остальные действия по строке блокируем,
  // чтобы не конфликтовать с параллельными запросами.
  const isModerating =
    approveMutation.isPending || rejectMutation.isPending;

  return (
    <TableRow>
      <TableCell>{review.authorName}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {review.targetUserName}
          <Badge variant="secondary">{review.targetRole}</Badge>
        </div>
      </TableCell>
      <TableCell>{review.rating} ★</TableCell>
      <TableCell className="max-w-64 truncate" title={review.text}>
        {review.text}
      </TableCell>
      <TableCell>{review.tripRoute}</TableCell>
      <TableCell>
        <ReviewStatusBadge status={review.status} />
      </TableCell>
      <TableCell>{formatDateTime(review.createdAt)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {review.status === "pending" && (
            <>
              <Button
                size="sm"
                disabled={isModerating}
                onClick={() => approveMutation.mutate(review.id)}
              >
                Одобрить
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isModerating}
                onClick={() => rejectMutation.mutate(review.id)}
              >
                Отклонить
              </Button>
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={isModerating}
            onClick={() => onDelete(review)}
          >
            Удалить
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ReviewsPagination({
  data,
  page,
  onPageChange,
}: {
  data: AdminPaginatedReviews;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        стр. {data.page} из {totalPages} · всего отзывов: {data.total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Назад
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}

function DeleteReviewDialog({
  review,
  isPending,
  onClose,
  onConfirm,
}: {
  review: AdminReviewDto | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={review !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить отзыв?</DialogTitle>
          <DialogDescription>
            {review
              ? `Отзыв от ${review.authorName} о ${review.targetUserName} (${review.tripRoute}) будет удалён безвозвратно. Это действие нельзя отменить.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Отмена
            </Button>
          </DialogClose>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Удаление..." : "Удалить отзыв"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewsLoading() {
  return (
    <div className="grid gap-3" role="status" aria-label="Загрузка отзывов">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function ReviewsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Не удалось загрузить отзывы</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </AlertAction>
    </Alert>
  );
}
