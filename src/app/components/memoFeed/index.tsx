import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonText,
} from '@ionic/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Transaction } from '../../utils/appTypes';
import { getMemoContent } from '../../utils/memoContent';
import { transactionID } from '../../utils/compat';

type FeedItem = Transaction & {
  txId: string;
};

const normalizePath = (value?: string) => {
  if (!value?.startsWith('/')) {
    return null;
  }

  const compact = `${value.replace(/0+=+$/g, '').replace(/\/{2,}/g, '/')}`;
  if (compact === '/') {
    return '/';
  }

  return compact.endsWith('/') ? compact : `${compact}/`;
};

const isSpatialKey = (value?: string) => Boolean(value?.startsWith('/'));

const isWithinPath = (path: string, targetPath: string) => {
  if (path === '/') {
    return true;
  }

  return targetPath.startsWith(path);
};

const byNewest = (a: FeedItem, b: FeedItem) => {
  const aSeries = a.series ?? 0;
  const bSeries = b.series ?? 0;

  if (aSeries !== bSeries) {
    return bSeries - aSeries;
  }

  if (a.time !== b.time) {
    return b.time - a.time;
  }

  return a.txId < b.txId ? 1 : -1;
};

export const normalizeFeedTransactions = (transactions: Transaction[]) => {
  const unique = new Map<string, FeedItem>();

  transactions.forEach((transaction) => {
    const txId = transactionID(transaction);
    unique.set(txId, {
      ...transaction,
      txId,
    });
  });

  return Array.from(unique.values()).sort(byNewest).slice(0, 500);
};

const MemoFeed = ({
  transactions,
  currentPath,
  canLoadMore,
  onLoadMore,
  focusTransactionId,
  onSwitchNavigator,
}: {
  transactions: Transaction[];
  currentPath: string;
  canLoadMore: boolean;
  onLoadMore: () => void;
  focusTransactionId?: string | null;
  onSwitchNavigator: (publicKey: string) => void;
}) => {
  const normalizedPath = normalizePath(currentPath) ?? '/';
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [renderedCount, setRenderedCount] = useState(1);

  const feedItems = useMemo(() => {
    return normalizeFeedTransactions(transactions).filter((item) => {
      const toPath = normalizePath(item.to);
      if (toPath) {
        return isWithinPath(normalizedPath, toPath);
      }

      return true;
    });
  }, [transactions, normalizedPath]);

  useEffect(() => {
    setActiveIndex(0);
    setRenderedCount(1);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [normalizedPath, transactions]);

  useEffect(() => {
    if (!focusTransactionId || !scrollRef.current) {
      return;
    }

    const index = feedItems.findIndex((item) => item.txId === focusTransactionId);
    if (index < 0) {
      return;
    }

    setRenderedCount((previous) => Math.max(previous, index + 1));
    const viewportHeight = scrollRef.current.clientHeight;
    scrollRef.current.scrollTo({ top: viewportHeight * index, behavior: 'smooth' });
    setActiveIndex(index);
  }, [feedItems, focusTransactionId]);

  useEffect(() => {
    if (activeIndex >= renderedCount - 1 && renderedCount < feedItems.length) {
      setRenderedCount((previous) => Math.min(feedItems.length, previous + 1));
      return;
    }

    if (activeIndex >= feedItems.length - 1 && canLoadMore) {
      onLoadMore();
    }
  }, [activeIndex, renderedCount, feedItems.length, canLoadMore, onLoadMore]);

  const visibleItems = feedItems.slice(0, renderedCount);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const viewportHeight = event.currentTarget.clientHeight || 1;
        const index = Math.round(event.currentTarget.scrollTop / viewportHeight);
        if (index !== activeIndex) {
          setActiveIndex(index);
        }
      }}
      style={{
        overflowY: 'auto',
        height: 'calc(100vh - 220px)',
        scrollSnapType: 'y mandatory',
      }}
    >
      {visibleItems.map((item) => {
        const content = getMemoContent(item.memo);
        const canDrillIn = !isSpatialKey(item.to);
        const canDrillOut = Boolean(item.from && !isSpatialKey(item.from));

        return (
          <div key={item.txId} id={`feed-item-${item.txId}`} style={{ scrollSnapAlign: 'start', minHeight: 'calc(100vh - 220px)' }}>
            <IonCard>
              <IonCardHeader>
                <IonCardSubtitle>{item.txId.slice(0, 14)}…</IonCardSubtitle>
                <IonCardTitle style={{ fontSize: 14 }}>
                  series: {item.series ?? 'n/a'} · time: {item.time}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {canDrillIn && (
                    <IonButton size="small" fill="outline" onClick={() => onSwitchNavigator(item.to)}>
                      Drill in
                    </IonButton>
                  )}
                  {canDrillOut && (
                    <IonButton
                      size="small"
                      fill="outline"
                      onClick={() => onSwitchNavigator(item.from as string)}
                    >
                      Drill out
                    </IonButton>
                  )}
                </div>

                {content.type === 'empty' && (
                  <IonText color="medium">
                    <p style={{ margin: 0, fontSize: 12 }}>{content.text}</p>
                  </IonText>
                )}

                {content.type === 'text' && (
                  <IonText>
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content.text}</p>
                  </IonText>
                )}

                {content.type === 'url' && (
                  <iframe
                    title="Memo web content"
                    src={content.url}
                    style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 8 }}
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                )}

                {content.type === 'youtube' && (
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '177.78%' }}>
                    <iframe
                      title="Memo YouTube short"
                      src={`https://www.youtube.com/embed/${content.videoId}?autoplay=1&mute=1&playsinline=1`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        );
      })}
    </div>
  );
};

export default MemoFeed;
