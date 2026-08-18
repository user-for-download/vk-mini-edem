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
  const isOpenRef = useRef(false);

  const confirm = useCallback<ConfirmApi>((nextOptions) => {
    if (isOpenRef.current) {
      return Promise.resolve(false);
    }

    isOpenRef.current = true;
    setOptions(nextOptions);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const resolve = (confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  };

  const handleClosed = () => {
    resolve(false);
    isOpenRef.current = false;
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
              action: () => resolve(true),
            },
          ]}
        />
      )}
    </ConfirmContext.Provider>
  );
};
