'use client';

import { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  isLoaded: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartItem[] };

interface CartContextType extends CartState {
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function cartReducer(state: CartState, action: CartAction): CartState {
  let newState: CartState;
  
  switch (action.type) {
    case 'HYDRATE':
      newState = { items: action.payload, isLoaded: true };
      break;
      
    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(
        (item) => item.menuItemId === action.payload.menuItemId && 
                  item.specialInstructions === action.payload.specialInstructions
      );
      
      if (existingItemIndex >= 0) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex].quantity += action.payload.quantity;
        newState = { ...state, items: updatedItems };
      } else {
        newState = { ...state, items: [...state.items, action.payload] };
      }
      break;
    }
      
    case 'REMOVE_ITEM':
      newState = {
        ...state,
        items: state.items.filter((item) => item.menuItemId !== action.payload),
      };
      break;
      
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        newState = {
          ...state,
          items: state.items.filter((item) => item.menuItemId !== action.payload.id),
        };
      } else {
        newState = {
          ...state,
          items: state.items.map((item) =>
            item.menuItemId === action.payload.id
              ? { ...item, quantity: action.payload.quantity }
              : item
          ),
        };
      }
      break;
      
    case 'CLEAR_CART':
      newState = { ...state, items: [] };
      break;
      
    default:
      return state;
  }
  
  return newState;
}

export function CartProvider({ tableId, children }: { tableId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isLoaded: false });
  const storageKey = `kh_cart_${tableId}`;

  // Load from session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = sessionStorage.getItem(storageKey);
      if (savedCart) {
        try {
          dispatch({ type: 'HYDRATE', payload: JSON.parse(savedCart) });
        } catch (e) {
          console.error('Failed to parse cart', e);
          dispatch({ type: 'HYDRATE', payload: [] });
        }
      } else {
        dispatch({ type: 'HYDRATE', payload: [] });
      }
    }
  }, [storageKey]);

  // Save to session storage
  useEffect(() => {
    if (state.isLoaded && typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(state.items));
    }
  }, [state.items, state.isLoaded, storageKey]);

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: { ...item, quantity: item.quantity || 1 },
    });
  };

  const removeItem = (itemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: itemId });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: itemId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getTotalItems = () => state.items.reduce((total, item) => total + item.quantity, 0);
  
  const getTotalPrice = () => state.items.reduce((total, item) => total + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
