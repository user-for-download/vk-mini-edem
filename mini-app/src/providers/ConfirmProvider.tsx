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
  const choiceRef = useRef(false);
  // Хвост очереди диалогов: следующий confirm открывается только после
  // полного закрытия предыдущего (onClosed), а не в анимации закрытия.
  const tailRef = useRef<Promise<void>>(Promise.resolve());

  const confirm = useCallback<ConfirmApi>((nextOptions) => {
    const { task, tail } = chainConfirmTask(tailRef.current, () => {
      choiceRef.current = false;
      setOptions(nextOptions);
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
    });
    tailRef.current = tail;
    return task;
  }, []);

  // Единственная точка резолва — факт закрытия алерта. Кнопка действия
  // лишь фиксирует выбор (сам алерт VKUI закрывает автоматически),
  // поэтому двойной confirm подряд больше не теряет второй диалог.
  const handleClosed = () => {
    resolveRef.current?.(choiceRef.current);
    resolveRef.current = null;
    choiceRef.current = false;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Alert
          title={options.title}
          description={options.description}
          dismissLabel="Отмена"
          onClosed={handleClosed}
          actions={[
            { title: "Отмена", mode: "cancel" },
            {
              title: options.confirmTitle,
              mode: options.confirmMode ?? "destructive",
              action: () => {
                choiceRef.current = true;
              },
            },
          ]}
        />
      )}
    </ConfirmContext.Provider>
  );
};
