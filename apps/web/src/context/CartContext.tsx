import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { api } from "../lib/api";
import type { Cart } from "../types";
import { useAuth } from "./AuthContext";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  loadCart: () => Promise<void>;
  addItem: (bookId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearLocal: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCart(null);
      setLoadedFor(null);
      return;
    }
    setLoading(true);
    try {
      const result = await api<Cart>("/api/cart");
      setCart(result.data);
    } finally {
      setLoading(false);
      setLoadedFor(user.id);
    }
  }, [user?.id]);
  useEffect(() => { void loadCart().catch(() => {}); }, [loadCart]);

  const addItem = useCallback(
    async (bookId: number, quantity = 1) => {
      await api("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ bookId, quantity })
      });
      await loadCart();
    },
    [loadCart]
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      await api(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity })
      });
      await loadCart();
    },
    [loadCart]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      await api(`/api/cart/items/${itemId}`, { method: "DELETE" });
      await loadCart();
    },
    [loadCart]
  );

  const value = useMemo(
    () => ({
      cart,
      loading: loading || (user !== null && loadedFor !== user.id),
      loadCart,
      addItem,
      updateItem,
      removeItem,
      clearLocal: () => setCart(null)
    }),
    [cart, loading, loadedFor, user, loadCart, addItem, updateItem, removeItem]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
