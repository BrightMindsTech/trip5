import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getDriverOrders, postDriverOrderAction } from '../api';
import i18n from '../i18n';
import { useAuth } from './AuthContext';
import { isDriverSubscriptionActive } from '../utils/driverSubscription';
import { describeDriverOrdersEndpoint } from '../config';

const DriverOrdersContext = createContext(null);

/** Poll driver-orders while driver app is open (any tab). Jobs tab used to be lazy-unmounted so offers never appeared. */
/** Slower than 5s to avoid stacking requests with auth + Edge Function limits. */
const DRIVER_JOBS_POLL_MS = 12000;

function augmentDriverJobsError(raw) {
  const m = String(raw || '').trim();
  const base = m || i18n.t('driver_error');
  if (/sign in again|not signed in|invalid or expired|401|please sign in/i.test(base)) {
    return `${base}\n\n${i18n.t('driver_jobs_auth_hint')}`;
  }
  if (/429|rate limit|too many requests/i.test(base)) {
    return `${base}\n\n${i18n.t('driver_jobs_rate_limit_hint')}`;
  }
  return base;
}

export function DriverOrdersProvider({ children }) {
  const { accessToken, profile, loading: authLoading } = useAuth();
  const loadGen = useRef(0);
  const incomingOfferRef = useRef(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [mine, setMine] = useState([]);
  const [subscriptionOk, setSubscriptionOk] = useState(true);
  const [jobsError, setJobsError] = useState(null);
  const [jobsBootloading, setJobsBootloading] = useState(true);
  /** Set when GET driver-orders succeeds (even if incomingOffer is null). */
  const [lastJobsSyncAt, setLastJobsSyncAt] = useState(null);

  const load = useCallback(async () => {
    const myGen = ++loadGen.current;

    if (authLoading) {
      if (myGen !== loadGen.current) return;
      setJobsError(null);
      return;
    }

    try {
      const data = await getDriverOrders(accessToken);
      if (myGen !== loadGen.current) return;
      setJobsError(null);
      setLastJobsSyncAt(Date.now());
      if (typeof data.subscriptionActive === 'boolean') {
        setSubscriptionOk(data.subscriptionActive);
      } else {
        setSubscriptionOk(isDriverSubscriptionActive(profile?.driver_subscription_valid_until));
      }
      const inc = data?.incomingOffer || null;
      incomingOfferRef.current = inc;
      setIncomingOffer(inc);
      setMine(Array.isArray(data?.mine) ? data.mine : []);
    } catch (e) {
      if (myGen !== loadGen.current) return;
      setJobsError(augmentDriverJobsError(e?.message));
      incomingOfferRef.current = null;
      setIncomingOffer(null);
      setMine([]);
      setSubscriptionOk(isDriverSubscriptionActive(profile?.driver_subscription_valid_until));
    }
  }, [accessToken, authLoading, profile?.driver_subscription_valid_until]);

  useEffect(() => {
    setJobsBootloading(true);
    load().finally(() => setJobsBootloading(false));
    const poll = setInterval(() => {
      load();
    }, DRIVER_JOBS_POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const respondOffer = useCallback(async (accept) => {
    const offer = incomingOfferRef.current;
    if (!offer?.offerId) return;

    await postDriverOrderAction(accessToken, {
      action: 'respond_offer',
      offerId: offer.offerId,
      accept,
    });
    await load();
  }, [accessToken, load]);

  const jobsEndpointInfo = useMemo(() => describeDriverOrdersEndpoint(), []);

  const value = useMemo(
    () => ({
      incomingOffer,
      mine,
      subscriptionOk,
      jobsError,
      jobsBootloading,
      lastJobsSyncAt,
      jobsEndpointInfo,
      refresh,
      respondOffer,
    }),
    [
      incomingOffer,
      mine,
      subscriptionOk,
      jobsError,
      jobsBootloading,
      lastJobsSyncAt,
      jobsEndpointInfo,
      refresh,
      respondOffer,
    ]
  );

  return <DriverOrdersContext.Provider value={value}>{children}</DriverOrdersContext.Provider>;
}

export function useDriverJobs() {
  const ctx = useContext(DriverOrdersContext);
  if (!ctx) {
    throw new Error('useDriverJobs must be used within DriverOrdersProvider');
  }
  return ctx;
}
