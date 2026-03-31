import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { submitOrder } from '../api';
import { useAuth } from './AuthContext';

const OrderContext = createContext();

export const useOrder = () => useContext(OrderContext);

const initialOrder = {
  route: null,
  isToday: true,
  scheduledDate: new Date(),
  service: null,
  pickup: null,
  destination: null,
  skipDestination: false,
};

export function OrderProvider({ children }) {
  const { accessToken } = useAuth();
  const [order, setOrder] = useState(initialOrder);
  const [currentStep, setCurrentStep] = useState(1);
  const [scheduleStep, setScheduleStep] = useState('date');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [orderSent, setOrderSent] = useState(false);

  useEffect(() => {
    if (currentStep !== 3) setScheduleStep('date');
  }, [currentStep]);

  const orderDate =
    order.scheduledDate instanceof Date
      ? order.scheduledDate
      : new Date(order.scheduledDate || Date.now());

  const updateOrder = useCallback((updates) => {
    setOrder((prev) => {
      const next = { ...prev, ...updates };
      if ('route' in updates && updates.route !== prev.route) {
        next.pickup = null;
        next.destination = null;
        next.service = null;
        next.skipDestination = false;
      }
      return next;
    });
  }, []);

  const isAirportRoute = ['airport_to_amman', 'airport_to_irbid', 'amman_to_airport', 'irbid_to_airport'].includes(
    order.route
  );

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, 4));
  }, []);

  const goBack = useCallback(() => {
    if (currentStep === 3) {
      if (scheduleStep === 'service') {
        setScheduleStep('time');
        return;
      }
      if (scheduleStep === 'time') {
        setScheduleStep('date');
        return;
      }
    }
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, [currentStep, scheduleStep]);

  const canProceedFromRoute = order.route !== null;

  const hasValidPickup =
    order.pickup &&
    order.pickup.latitude != null &&
    order.pickup.longitude != null;
  const hasValidDestination =
    order.destination &&
    order.destination.latitude != null &&
    order.destination.longitude != null;

  const canProceedFromLocations =
    hasValidPickup && (order.skipDestination || hasValidDestination);

  const serviceOk =
    isAirportRoute ||
    (order.service &&
      (order.service.type !== 'instant' || (order.service.description || '').trim()));

  const canProceedFromServiceSchedule = isAirportRoute
    ? scheduleStep === 'time'
    : scheduleStep === 'service' && serviceOk;

  const buildOrderPayload = useCallback(() => {
    const base = {
      route: order.route,
      date: orderDate.toISOString(),
      service: formatService(order.service),
      pickup: {
        latitude: order.pickup.latitude,
        longitude: order.pickup.longitude,
        address: order.pickup.address,
      },
    };
    if (order.skipDestination) {
      return {
        ...base,
        skip_destination: true,
        destination: {
          pending: true,
          latitude: null,
          longitude: null,
          address: 'Pending',
        },
      };
    }
    return {
      ...base,
      skip_destination: false,
      destination: {
        latitude: order.destination.latitude,
        longitude: order.destination.longitude,
        address: order.destination.address,
      },
    };
  }, [order, orderDate]);

  const formatService = (service) => {
    if (!service) return null;
    if (service.type === 'basic') return { type: 'basic' };
    if (service.type === 'private') return { type: 'private', alone: service.alone };
    if (service.type === 'airport') return { type: 'airport', toAirport: service.toAirport };
    if (service.type === 'instant') return { type: 'instant', description: service.description };
    return null;
  };

  const submit = useCallback(async () => {
    if (!order.pickup) return;
    if (!order.skipDestination && (!order.destination || order.destination.latitude == null)) return;
    if (!accessToken) {
      setSubmitError('Not signed in.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitOrder(buildOrderPayload(), accessToken);
      setOrderSent(true);
    } catch (err) {
      setSubmitError(err.message || 'Failed to send. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [order, buildOrderPayload, accessToken]);

  const resetOrder = useCallback(() => {
    setOrder(initialOrder);
    setCurrentStep(1);
    setScheduleStep('date');
    setIsSubmitting(false);
    setSubmitError(null);
    setOrderSent(false);
  }, []);

  const value = {
    order,
    updateOrder,
    currentStep,
    goNext,
    goBack,
    setCurrentStep,
    scheduleStep,
    setScheduleStep,
    canProceedFromRoute,
    canProceedFromLocations,
    canProceedFromServiceSchedule,
    orderDate,
    isSubmitting,
    submitError,
    orderSent,
    submit,
    resetOrder,
    buildOrderPayload,
    isAirportRoute,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
