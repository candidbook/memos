import { PageShell } from '../components/pageShell';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../utils/appContext';
import DirTree from '../components/dirTree';
import MemoFeed, { FeedTreeContext } from '../components/memoFeed';
import {
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  useIonModal,
} from '@ionic/react';
import { terminalOutline, addCircleOutline } from 'ionicons/icons';
import WebsocketConsole from './console';
import Send from './send';
import { indexTransactionsToGraph } from '../utils/indexer';
import { Transaction } from '../utils/appTypes';

const toDisplayKey = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue || '/';
};

const rootKeyFor = (treeKind: 'spatial' | 'temporal' | 'periodic') => {
  if (treeKind === 'spatial') {
    return '/';
  }

  return '0';
};

const splitKeySegments = (key: string, treeKind: 'spatial' | 'temporal' | 'periodic') => {
  if (treeKind === 'spatial') {
    const normalized = toDisplayKey(key);
    if (normalized === '/') {
      return [] as string[];
    }

    return normalized.split('/').filter(Boolean);
  }

  if (treeKind === 'temporal') {
    return key.split('+').filter(Boolean);
  }

  return [key];
};

const buildSegments = (key: string, treeKind: 'spatial' | 'temporal' | 'periodic') => {
  const parts = splitKeySegments(key, treeKind);

  if (treeKind === 'spatial') {
    let currentPath = '/';
    return parts.map((segment) => {
      currentPath = `${currentPath}${segment}/`;
      return { label: segment, value: currentPath };
    });
  }

  if (treeKind === 'temporal') {
    let current = '';
    return parts.map((segment) => {
      current = current ? `${current}+${segment}` : segment;
      return { label: segment, value: current };
    });
  }

  return parts.map((segment) => ({ label: segment, value: segment }));
};

const Explore = () => {
  const {
    graph,
    setGraph,
    tipHeader,
    navigatorPublicKey,
    setNavigatorPublicKey,
    transactionRange,
    requestPkTransactions,
  } =
    useContext(AppContext);

  const [mode, setMode] = useState<'feed' | 'tree'>('feed');
  const [treeKind, setTreeKind] = useState<'spatial' | 'temporal' | 'periodic'>('spatial');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetchStartHeight, setFetchStartHeight] = useState<number>(0);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [focusTransactionId, setFocusTransactionId] = useState<string | null>(null);
  const [peekGraphKey, setPeekGraphKey] = useState<string>('/');

  const displayKey = useMemo(() => toDisplayKey(peekGraphKey), [peekGraphKey]);
  const clickableSegments = useMemo(
    () => buildSegments(displayKey, treeKind),
    [displayKey, treeKind],
  );

  const [presentSendModal, dismissSend] = useIonModal(Send, {
    onDismiss: (data: string, role: string) => dismissSend(data, role),
    forKey: displayKey,
  });

  const [presentSocketConsole, dismissSocketConsole] = useIonModal(WebsocketConsole, {
    onDismiss: () => dismissSocketConsole(),
  });

  const fetchTransactions = useCallback((
    startHeight: number,
    endHeight: number,
    replace: boolean,
  ) => {
    if (!navigatorPublicKey) {
      return;
    }

    requestPkTransactions(
      navigatorPublicKey,
      (nextTransactions) => {
        setTransactions((previous) =>
          replace ? nextTransactions : [...previous, ...nextTransactions],
        );
        setCanLoadMore(nextTransactions.length >= transactionRange.limit);
      },
      {
        startHeight,
        endHeight,
        limit: transactionRange.limit,
      },
    );
  }, [navigatorPublicKey, requestPkTransactions, transactionRange.limit]);

  useEffect(() => {
    let cleanup = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!navigatorPublicKey) {
        setGraph(null);
        setTransactions([]);
        setCanLoadMore(false);
        return;
      }

      const latestStartHeight = tipHeader?.header.height
        ? tipHeader.header.height + 1
        : transactionRange.startHeight;
      setFetchStartHeight(latestStartHeight);
      cleanup =
        requestPkTransactions(
          navigatorPublicKey,
          (nextTransactions) => {
            setTransactions(nextTransactions);
            setCanLoadMore(nextTransactions.length >= transactionRange.limit);
          },
          {
            startHeight: latestStartHeight,
            endHeight: 0,
            limit: transactionRange.limit,
          },
        ) ?? cleanup;
    }, 0);

    return () => {
      cleanup();
      window.clearTimeout(timeoutId);
    };
  }, [
    navigatorPublicKey,
    requestPkTransactions,
    setGraph,
    tipHeader?.header.height,
    transactionRange.endHeight,
    transactionRange.limit,
    transactionRange.startHeight,
  ]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (displayKey && data.detail) {
        if (!navigatorPublicKey) {
          return;
        }
        requestPkTransactions(
          navigatorPublicKey,
          (nextTransactions) => {
            setTransactions(nextTransactions);
            setCanLoadMore(nextTransactions.length >= transactionRange.limit);
          },
          {
            startHeight: tipHeader?.header.height
              ? tipHeader.header.height + 1
              : transactionRange.startHeight,
            endHeight: 0,
            limit: transactionRange.limit,
          },
        );
      }
    };

    document.addEventListener('inv_block', resultHandler);

    return () => {
      document.removeEventListener('inv_block', resultHandler);
    };
  }, [
    navigatorPublicKey,
    requestPkTransactions,
    tipHeader?.header.height,
    transactionRange.endHeight,
    transactionRange.limit,
    transactionRange.startHeight,
    displayKey,
  ]);

  useEffect(() => {
    if (!navigatorPublicKey) {
      setGraph(null);
      return;
    }

    setGraph(indexTransactionsToGraph(transactions, navigatorPublicKey));
  }, [navigatorPublicKey, setGraph, transactions]);

  const loadMore = useCallback(() => {
    if (!canLoadMore) {
      return;
    }

    const nextEndHeight = fetchStartHeight - 1;
    const nextStartHeight = Math.max(1, nextEndHeight - transactionRange.limit + 1);
    setFetchStartHeight(nextStartHeight);
    fetchTransactions(nextStartHeight, nextEndHeight, false);
  }, [canLoadMore, fetchStartHeight, fetchTransactions, transactionRange.limit]);

  const applyFeedContext = useCallback((context: FeedTreeContext) => {
    setPeekGraphKey(context.key);
    setTreeKind(context.treeKind);
  }, []);

  return (
    <PageShell
      tools={[
        {
          label: 'Send',
          renderIcon: () => <IonIcon slot="icon-only" icon={addCircleOutline} />,
          action: () => presentSendModal(),
        },
        {
          label: 'WebSocket console',
          renderIcon: () => <IonIcon slot="icon-only" icon={terminalOutline} />,
          action: () => presentSocketConsole(),
        },
      ]}
      renderBody={() => (
        <>
          {!!displayKey && (
            <>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: 'var(--ion-background-color)',
                  borderBottom: '1px solid var(--ion-color-step-150)',
                  padding: '8px 0',
                  marginBottom: 8,
                }}
              >
                <IonSegment
                  value={treeKind}
                  onIonChange={(event) => setTreeKind(event.detail.value as 'spatial' | 'temporal' | 'periodic')}
                >
                  <IonSegmentButton value="spatial">
                    <IonLabel>Spatial</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="temporal">
                    <IonLabel>Temporal</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="periodic">
                    <IonLabel>Periodic</IonLabel>
                  </IonSegmentButton>
                </IonSegment>

                <div style={{ fontFamily: 'monospace, monospace', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPeekGraphKey(rootKeyFor(treeKind));
                      if (mode === 'feed') {
                        setMode('tree');
                      }
                    }}
                    style={{ border: 'none', background: 'transparent', color: 'var(--ion-color-primary)', textDecoration: 'underline' }}
                  >
                    ..
                  </button>
                  <code>{rootKeyFor(treeKind)}</code>
                  {clickableSegments.map((segment, index) => (
                    <div key={segment.value} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPeekGraphKey(segment.value);
                          if (mode === 'feed') {
                            setMode('tree');
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', color: 'var(--ion-color-primary)', textDecoration: 'underline' }}
                      >
                        {segment.label}
                      </button>
                      {index < clickableSegments.length - 1 && <code>{treeKind === 'spatial' ? '/' : '+'}</code>}
                    </div>
                  ))}
                </div>
                {mode === 'tree' && (
                  <div style={{ marginTop: 8 }}>
                    <IonButton size="small" fill="outline" onClick={() => setMode('feed')}>
                      Back to feed
                    </IonButton>
                  </div>
                )}
              </div>
              {!!graph && (
                <>
                  {mode === 'tree' && (
                    <DirTree
                      forKey={displayKey}
                      treeKind={treeKind}
                      nodes={graph.nodes ?? []}
                      links={graph.links ?? []}
                      setForKey={setPeekGraphKey}
                      onLeafOpen={(txId) => {
                        setMode('feed');
                        setFocusTransactionId(txId);
                      }}
                    />
                  )}
                  {mode === 'feed' && (
                    <MemoFeed
                      transactions={transactions}
                      onLoadMore={loadMore}
                      canLoadMore={canLoadMore}
                      focusTransactionId={focusTransactionId}
                      onSwitchNavigator={(nextKey) => {
                        setNavigatorPublicKey(nextKey);
                        setPeekGraphKey('/');
                        setTreeKind('spatial');
                        setMode('feed');
                      }}
                      onActiveContextChange={applyFeedContext}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    />
  );
};

export default Explore;
