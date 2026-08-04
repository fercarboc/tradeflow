import { useCartContext } from '../context/CarritoProvider';
import type { CartContextValue } from '../context/CarritoProvider';

export type { CartContextValue };

/**
 * Hook para consumir el contexto del carrito marketplace.
 * Lanza un error descriptivo si se usa fuera de CarritoProvider.
 */
export function useMarketplaceCart(): CartContextValue {
  return useCartContext();
}
