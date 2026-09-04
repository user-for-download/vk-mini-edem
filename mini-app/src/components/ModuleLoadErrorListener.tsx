import { useEffect } from "react";
import { MODULE_LOAD_ERROR_EVENT } from "@/helpers/loadModule";
import { useSnackbar } from "@/providers/SnackbarProvider";

export function ModuleLoadErrorListener() {
  const { enqueue } = useSnackbar();

  useEffect(() => {
    const handleError = () => {
      enqueue({
        type: "error",
        title: "Не удалось загрузить экран",
        subtitle: "Проверьте соединение или обновите приложение",
        actionLabel: "Обновить",
        onActionClick: () => window.location.reload(),
        dedupeKey: "module_load_error",
      });
    };

    window.addEventListener(MODULE_LOAD_ERROR_EVENT, handleError);
    return () => window.removeEventListener(MODULE_LOAD_ERROR_EVENT, handleError);
  }, [enqueue]);

  return null;
}
