export const MODULE_LOAD_ERROR_EVENT = "edem:module-load-error";

export async function loadModule<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    console.error("Failed to load application module", error);
    globalThis.dispatchEvent?.(new Event(MODULE_LOAD_ERROR_EVENT));
    return null;
  }
}

export async function loadLazyModule<T>(loader: () => Promise<T>): Promise<T> {
  const module = await loadModule(loader);
  if (module) return module;
  throw new Error("Application module failed to load");
}
