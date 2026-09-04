import type { AdminDashboardDto } from "@edem/contracts";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useDashboardQuery } from "./queries";

const METRICS: Array<{
  key: keyof AdminDashboardDto;
  label: string;
  description: string;
}> = [
  {
    key: "totalUsers",
    label: "Всего пользователей",
    description: "Зарегистрированные аккаунты",
  },
  {
    key: "totalTrips",
    label: "Всего поездок",
    description: "Создано за всё время",
  },
  {
    key: "activeTrips",
    label: "Активные поездки",
    description: "Открыты для бронирования",
  },
  {
    key: "totalBookings",
    label: "Бронирования",
    description: "Всего забронированных мест",
  },
  {
    key: "totalReviews",
    label: "Отзывы",
    description: "Оставлено пользователями",
  },
  {
    key: "newUsersLast7Days",
    label: "Новых за 7 дней",
    description: "Регистрации за последнюю неделю",
  },
];

const GRID_CLASS = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">
          {value.toLocaleString("ru-RU")}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { isPending, isError, error, data, refetch } = useDashboardQuery();

  if (isPending) {
    return (
      <div role="status" aria-label="Загрузка дашборда" className={GRID_CLASS}>
        {METRICS.map((metric) => (
          <Skeleton key={metric.key} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Дашборд недоступен</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
        <AlertAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
          >
            Повторить
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <div className={GRID_CLASS}>
      {METRICS.map((metric) => (
        <MetricCard
          key={metric.key}
          label={metric.label}
          value={data[metric.key]}
          description={metric.description}
        />
      ))}
    </div>
  );
}
