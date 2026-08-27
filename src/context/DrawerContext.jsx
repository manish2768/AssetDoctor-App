/**
 * Asset Doctor — Drawer State & Interaction Context
 * Provides global open/close controls, smooth animation values,
 * and hardware back-button interceptor for Android.
 */

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Animated, BackHandler, Easing } from 'react-native';
import { Haptics } from '../services/haptics';

const DrawerContext = createContext({
  isOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  animatedProgress: new Animated.Value(0),
});

export function DrawerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const animatedProgress = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback((toValue, callback) => {
    Animated.timing(animatedProgress, {
      toValue,
      duration: toValue === 1 ? 260 : 200,
      easing: toValue === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && callback) callback();
    });
  }, [animatedProgress]);

  const openDrawer = useCallback(() => {
    Haptics.tap();
    setIsOpen(true);
    animateTo(1);
  }, [animateTo]);

  const closeDrawer = useCallback(() => {
    animateTo(0, () => {
      setIsOpen(false);
    });
  }, [animateTo]);

  const toggleDrawer = useCallback(() => {
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }, [isOpen, openDrawer, closeDrawer]);

  // Intercept Android hardware back button when drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const onBackPress = () => {
      closeDrawer();
      return true; // Handled
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isOpen, closeDrawer]);

  const value = {
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    animatedProgress,
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
}
