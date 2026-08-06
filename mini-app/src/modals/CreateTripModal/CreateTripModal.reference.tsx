// mini-app/src/modals/CreateTripModal/CreateTripModal.reference.tsx
//
// Референсный паттерн VKUI v8 для всех модалок и панелей.
// Используется как шаблон для EditTripModal, CarFormModal, EditProfileModal.
// НЕ импортируется в приложение.
import { useState, useCallback } from "react";
import {
  ModalPage,
  ModalPageHeader,
  ModalDismissButton,
  Group,
  FormItem,
  FormLayoutGroup,
  Input,
  DateInput,
  ChipsSelect,
  Textarea,
  ButtonGroup,
  Button,
  FormStatus,
  Spacing,
} from "@vkontakte/vkui";
import type { ChipOption } from "@vkontakte/vkui";

const TAGS_OPTIONS: ChipOption[] = [
  { value: "Тихая поездка", label: "Тихая поездка" },
  { value: "С остановками", label: "С остановками" },
  { value: "Есть багаж", label: "Есть багаж" },
  { value: "Можно с животными", label: "Можно с животными" },
  { value: "Не курить", label: "Не курить" },
  { value: "Только девушки", label: "Только девушки" },
  { value: "Можно с детьми", label: "Можно с детьми" },
];

interface CreateTripModalProps {
  id: string;
  onClose: () => void;
}

export function CreateTripModal({ id, onClose }: CreateTripModalProps) {
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [departureAt, setDepartureAt] = useState<Date | null>(null);
  const [price, setPrice] = useState("");
  const [seatsTotal, setSeatsTotal] = useState("4");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [tags, setTags] = useState<ChipOption[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!fromCity || !toCity || !departureAt || !price || !seatsTotal) {
      setError("Заполните все обязательные поля");
      return;
    }

    setLoading(true);
    try {
      // TODO: вызов API
      onClose();
    } catch {
      setError("Не удалось создать поездку. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }, [fromCity, toCity, departureAt, price, seatsTotal, onClose]);

  return (
    <ModalPage
      id={id}
      header={
        <ModalPageHeader before={<ModalDismissButton onClick={onClose} />}>
          Новая поездка
        </ModalPageHeader>
      }
    >
      <Group>
        {error && (
          <FormItem>
            <FormStatus mode="error">{error}</FormStatus>
          </FormItem>
        )}

          <FormLayoutGroup mode="horizontal">
            <FormItem top="Откуда" htmlFor="fromCity">
              <Input
                id="fromCity"
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value)}
                placeholder="Москва"
              />
            </FormItem>
            <FormItem top="Куда" htmlFor="toCity">
              <Input
                id="toCity"
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                placeholder="Тула"
              />
            </FormItem>
          </FormLayoutGroup>

          <FormLayoutGroup mode="horizontal">
            <FormItem top="Адрес отправления" htmlFor="fromAddress">
              <Input
                id="fromAddress"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="м. Тёплый Стан"
              />
            </FormItem>
            <FormItem top="Адрес прибытия" htmlFor="toAddress">
              <Input
                id="toAddress"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="Центр"
              />
            </FormItem>
          </FormLayoutGroup>

          <FormItem top="Дата и время отправления">
            <DateInput
              value={departureAt}
              onChange={setDepartureAt}
              enableTime
              closeOnChange={false}
              placeholder="Выберите дату и время"
            />
          </FormItem>

          <FormLayoutGroup mode="horizontal">
            <FormItem top="Цена, ₽" htmlFor="price">
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1000"
              />
            </FormItem>
            <FormItem top="Мест" htmlFor="seats">
              <Input
                id="seats"
                type="number"
                value={seatsTotal}
                onChange={(e) => setSeatsTotal(e.target.value)}
                min={1}
                max={4}
              />
            </FormItem>
          </FormLayoutGroup>

          <FormLayoutGroup mode="horizontal">
            <FormItem top="Длительность, мин" htmlFor="duration">
              <Input
                id="duration"
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="120"
              />
            </FormItem>
            <FormItem top="Расстояние, км" htmlFor="distance">
              <Input
                id="distance"
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="180"
              />
            </FormItem>
          </FormLayoutGroup>

          <FormItem top="Теги">
            <ChipsSelect
              value={tags}
              onChange={setTags}
              options={TAGS_OPTIONS}
              placeholder="Выберите или введите тег"
              creatable
              allowClearButton
            />
          </FormItem>

          <FormItem top="Комментарий водителя">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Остановки, багаж, правила в машине..."
            />
          </FormItem>

          <Spacing size={16} />

          <FormItem>
            <ButtonGroup mode="vertical" gap="m" stretched>
              <Button
                size="l"
                mode="primary"
                stretched
                loading={loading}
                onClick={handleSubmit}
              >
                Создать поездку
              </Button>
              <Button
                size="l"
                mode="secondary"
                stretched
                onClick={onClose}
              >
                Отмена
              </Button>
            </ButtonGroup>
          </FormItem>

      </Group>
    </ModalPage>
  );
}
