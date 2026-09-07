import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";
import { Alert } from "@vkontakte/vkui";
import { chainConfirmTask } from "@/helpers/confirmQueue";

// Локальная копия типа из Alert.tsx (корень пакета его не экспортирует):
// 'click-item' — тап по кнопке действия (обрабатывается action-хендлером),
// остальное — оверлей / Esc / крестик (считаем отменой).
type AlertCloseReason =
  | "click-overlay"
  | "click-item"
  | "escape-key"
  | "click-close-button";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmTitle: string;
  confirmMode?: "default" | "destructive";
}

type ConfirmApi = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmApi | null>(null);

export const useConfirm = (): ConfirmApi => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
};

export const ConfirmProvider: FC<PropsWithChildren> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  // Хвост очереди диалогов: следующий confirm открывается только после
  // завершения предыдущего (иначе второй диалог пересоздавал бы закрывающийся
  // инстанс и мгновенно размонтировался через onClosed).
  const tailRef = useRef<Promise<void>>(Promise.resolve());

  // Мгновенное завершение БЕЗ ожидания анимации закрытия: по умолчанию VKUI
  // откладывает action-хендлер до onExited (animationend), а в части окружений
  // (Android WebView) это событие не приходит — промис висел вечно и удаление
  // профиля молча не работало. Поэтому обеим кнопкам выставлен
  // autoCloseDisabled: action выполняется СИНХРОННО в тапе, диалог
  // анмаунтится сразу (exit-анимации нет — надёжность важнее красоты).
  const settle = useCallback((value: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOptions(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmApi>(
    (nextOptions) => {
      const { task, tail } = chainConfirmTask(tailRef.current, () => {
        setOptions(nextOptions);
        return new Promise<boolean>((resolve) => {
          resolveRef.current = resolve;
        });
      });
      tailRef.current = tail;
      return task;
    },
    [],
  );

  // Оверлей / Esc / крестик: onClose приходит синхронно в момент закрытия
  // (до анимации) — резолвим false сразу. 'click-item' игнорируем: за кнопки
  // отвечают их action-хендлеры (settle выше), иначе клик по кнопке
  // резолвил бы false раньше action.
  const handleClose = useCallback(
    (reason: AlertCloseReason) => {
      if (reason !== "click-item") {
        settle(false);
      }
    },
    [settle],
  );

  // Safety net: если Alert размонтировался иным путём (напр. unmount дерева),
  // висящий промис не должен жить вечно.
  const handleClosed = useCallback(() => {
    if (resolveRef.current) {
      settle(false);
    }
  }, [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Alert
          title={options.title}
          description={options.description}
          dismissLabel="Отмена"
          onClose={handleClose}
          onClosed={handleClosed}
          actions={[
            {
              title: "Отмена",
              mode: "cancel",
              autoCloseDisabled: true,
              action: () => settle(false),
            },
            {
              title: options.confirmTitle,
              mode: options.confirmMode ?? "destructive",
              autoCloseDisabled: true,
              action: () => settle(true),
            },
          ]}
        />
      )}
    </ConfirmContext.Provider>
  );
};
