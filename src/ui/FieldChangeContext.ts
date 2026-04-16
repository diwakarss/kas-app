/**
 * FieldChangeContext
 *
 * Provides a callback for field value changes from json-render rendered
 * FieldRenderer and EntityPicker components back to the screen that
 * manages form state. The screen wraps the Renderer in this provider,
 * and the registry component wrappers consume it.
 */

import { createContext, useContext } from 'react';

type FieldChangeHandler = (value: unknown) => void;

const FieldChangeContext = createContext<FieldChangeHandler>(() => {});

export const FieldChangeProvider = FieldChangeContext.Provider;

export function useFieldChange(): FieldChangeHandler {
  return useContext(FieldChangeContext);
}
