import { create } from 'zustand';

interface POSItem {
  id: string; // Product ID
  name: string;
  sku: string;
  price: number;
  qty: number;
  uom_id: string;
}

interface POSState {
  cart: POSItem[];
  addItem: (item: Omit<POSItem, 'qty'>) => void;
  updatePrice: (id: string, price: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

export const usePOSStore = create<POSState>((set) => ({
  cart: [],
  addItem: (item) => set((state) => {
    const existing = state.cart.find((i) => i.id === item.id);
    if (existing) {
      return { cart: state.cart.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) };
    }
    return { cart: [...state.cart, { ...item, qty: 1 }] };
  }),
  updatePrice: (id, price) => set((state) => ({
    cart: state.cart.map((i) => i.id === id ? { ...i, price } : i)
  })),
  removeItem: (id) => set((state) => ({
    cart: state.cart.filter((i) => i.id !== id)
  })),
  clearCart: () => set({ cart: [] }),
}));
