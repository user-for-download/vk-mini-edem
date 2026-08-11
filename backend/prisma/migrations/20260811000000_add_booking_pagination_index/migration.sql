-- Индекс для cursor-based пагинации заявок поездки
-- Поддерживает: WHERE tripId = ? ORDER BY createdAt DESC
CREATE INDEX "Booking_tripId_createdAt_idx" 
  ON "Booking"("tripId", "createdAt" DESC);
