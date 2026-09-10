import { Button, Cell, Section } from "@telegram-apps/telegram-ui";
import type { Trip } from "@edem/contracts";
import { useNavigate } from "react-router-dom";

export function TripCard({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  return (
    <Section>
      <Cell subtitle={`${trip.date} в ${trip.time} · ${trip.seatsAvailable} мест`} description={`${trip.price} ₽ · ${trip.driver.name}`}>
        {trip.fromCity} → {trip.toCity}
      </Cell>
      <Button stretched size="m" onClick={() => navigate(`/trips/${trip.id}`)}>Подробнее</Button>
    </Section>
  );
}
