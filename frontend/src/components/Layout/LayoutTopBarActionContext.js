import { createContext } from 'react';

/** Lets pages under Layout register a React node for MobileTopBar `rightSlot` (e.g. Add Device). */
export const LayoutTopBarActionContext = createContext(null);
