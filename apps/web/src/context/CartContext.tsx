import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { api, ApiError } from "../lib/api";
import type { Cart } from "../types";
import { useAuth } from "./AuthContext";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  error: string;
  recovery: { kind: "committed" | "uncertain"; message: string } | null;
  mutating: boolean;
  loadCart: () => Promise<void>;
  addItem: (bookId: number, quantity?: number) => Promise<{ synchronized: boolean }>;
  updateItem: (itemId: number, quantity: number) => Promise<{ synchronized: boolean }>;
  removeItem: (itemId: number) => Promise<{ synchronized: boolean }>;
  clearLocal: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<{ owner: number; cart: Cart } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [error, setError] = useState("");
  type Recovery = { owner: number; kind: "committed" | "uncertain"; message: string };
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const recoveryRef = useRef<Recovery | null>(null);
  const mutations = useRef(new Map<number, AbortController>());
  const [mutationVersion, setMutationVersion] = useState(0);
  const owner = user?.id ?? null;
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const requestVersion = useRef(0);

  const loadCart = useCallback(async () => {
    // A mutation that started under another account must not refresh this account.
    if (owner !== activeOwner.current) return;
    const version = ++requestVersion.current;
    if (owner === null) {
      setSnapshot(null);
      setLoadedFor(null);
      setError("");
      setLoading(false);
      recoveryRef.current = null; setRecovery(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<Cart>("/api/cart");
      if (version === requestVersion.current && owner === activeOwner.current) {
        setSnapshot({ owner, cart: result.data });
        recoveryRef.current = null; setRecovery(null);
      }
    } catch (cause) {
      if (version === requestVersion.current && owner === activeOwner.current) {
        setError(cause instanceof Error ? cause.message : "Không thể tải giỏ hàng.");
        if (recoveryRef.current?.owner === owner) setRecovery(recoveryRef.current);
      }
      throw cause;
    } finally {
      if (version === requestVersion.current && owner === activeOwner.current) {
        setLoading(false);
        setLoadedFor(owner);
      }
    }
  }, [owner]);
  useEffect(() => {
    for (const [mutationOwner, controller] of mutations.current) {
      if (mutationOwner !== owner) controller.abort();
    }
    void loadCart().catch(() => {});
  }, [loadCart, owner]);

  const mutate = useCallback(async (path: string, options: RequestInit, confirmedMessage: string) => {
    if (owner === null || owner !== activeOwner.current) throw new ApiError("Vui lòng đăng nhập để cập nhật giỏ hàng.", 401);
    if (mutations.current.has(owner)) throw new ApiError("Giỏ hàng đang được cập nhật. Vui lòng chờ.", 409, "CART_BUSY");
    if (recoveryRef.current?.owner === owner) throw new ApiError("Tải lại giỏ hàng trước khi thao tác tiếp.", 409, "CART_SYNC_REQUIRED");
    const controller = new AbortController();
    mutations.current.set(owner, controller); setMutationVersion(value => value + 1);
    try {
      try { await api(path, { ...options, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) }); }
      catch (cause) {
        if (controller.signal.aborted || owner !== activeOwner.current) throw new ApiError("Tài khoản đã thay đổi. Vui lòng kiểm tra giỏ hàng hiện tại.", 409, "CART_ACCOUNT_CHANGED");
        if (owner === activeOwner.current && cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)) {
          // Earlier reads cannot resolve an unknown write outcome.
          ++requestVersion.current;
          const issue: Recovery = { owner, kind: "uncertain", message: `${cause.message} Chưa xác nhận được thay đổi. Tải lại giỏ để kiểm tra số lượng trước khi thao tác tiếp.` };
          recoveryRef.current = issue; setRecovery(issue); setLoading(false); setLoadedFor(owner);
          throw new ApiError(cause.message, cause.status, "CART_RESULT_UNCERTAIN", cause.requestId);
        }
        throw cause;
      }
      if (controller.signal.aborted || owner !== activeOwner.current) throw new ApiError("Tài khoản đã thay đổi. Vui lòng kiểm tra giỏ hàng hiện tại.", 409, "CART_ACCOUNT_CHANGED");
      recoveryRef.current = { owner, kind: "committed", message: confirmedMessage };
      // This fresh read also invalidates older reads started before the write.
      // A failed GET is a synchronization failure, not a failed write.
      await loadCart().catch(() => undefined);
      if (controller.signal.aborted || owner !== activeOwner.current) throw new ApiError("Tài khoản đã thay đổi. Vui lòng kiểm tra giỏ hàng hiện tại.", 409, "CART_ACCOUNT_CHANGED");
      return { synchronized: recoveryRef.current?.owner !== owner };
    } finally {
      mutations.current.delete(owner); setMutationVersion(value => value + 1);
    }
  }, [owner, loadCart]);

  const addItem = useCallback((bookId: number, quantity = 1) => mutate("/api/cart/items", {
    method: "POST", body: JSON.stringify({ bookId, quantity })
  }, "Đã thêm sách. Chưa tải được giỏ hàng mới."), [mutate]);

  const updateItem = useCallback(
    (itemId: number, quantity: number) => mutate(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity })
      }, "Đã đổi số lượng. Chưa tải được giỏ hàng mới."),
    [mutate]
  );

  const removeItem = useCallback(
    (itemId: number) => mutate(`/api/cart/items/${itemId}`, { method: "DELETE" }, "Đã xóa sách. Chưa tải được giỏ hàng mới."),
    [mutate]
  );

  const value = useMemo(
    () => ({
      cart: snapshot?.owner === owner ? snapshot.cart : null,
      error: loadedFor === owner ? error : "",
      recovery: recovery?.owner === owner ? recovery : null,
      mutating: owner !== null && mutations.current.has(owner),
      loading: loading || (owner !== null && loadedFor !== owner),
      loadCart,
      addItem,
      updateItem,
      removeItem,
      clearLocal: () => {
        if (owner !== activeOwner.current) return;
        ++requestVersion.current; setSnapshot(null); setError(""); setLoading(false);
        recoveryRef.current = null; setRecovery(null);
      }
    }),
    [snapshot, error, recovery, mutationVersion, loading, loadedFor, owner, loadCart, addItem, updateItem, removeItem]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
