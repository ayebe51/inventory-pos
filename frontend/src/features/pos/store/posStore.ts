import { create } from 'zustand';

interface POSItem {
  id: string; // Product ID
  name: string;
  sku: string;
  price: number;
  qty: number;
}

interface POSState {
  cart: POSItem[];
  addItem: (item: Omit<POSItem, 'qty'>) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotals: () => { subtotal: number; tax: number; total: number };
}

export const usePOSStore = create<POSState>((set, get) => ({
  cart: [],
  addItem: (item) => set((state) => {
    const existing = state.cart.find((i) => i.id === item.id);
    if (existing) {
      return { cart: state.cart.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) };
    }
    return { cart: [...state.cart, { ...item, qty: 1 }] };
  }),
  updateQty: (id, qty) => set((state) => ({
    cart: state.cart.map((i) => i.id === id ? { ...i, qty } : i)
  })),
  removeItem: (id) => set((state) => ({
    cart: state.cart.filter((i) => i.id !== id)
  })),
  clearCart: () => set({ cart: [] }),
  getTotals: () => {
    const cart = get().cart;
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * 0.11; // 11% PPN
    return { subtotal, tax, total: subtotal + tax };
  }
}));
