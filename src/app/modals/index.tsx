import { PageShell } from '../components/pageShell';
import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../utils/appContext';
import DirTree from '../components/dirTree';
import { IonIcon, useIonModal } from '@ionic/react';
import { terminalOutline, timerOutline, optionsOutline, addCircleOutline } from 'ionicons/icons';
import WebsocketConsole from './websocketConsole';
import Sequence from './sequence';
import Assert from './assert';
import Filter from './filter';
import { indexTransactionsToGraph } from '../utils/directoryIndexer';

const toDisplayPath = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue || '/';
};

const Explore = () => {
  const {
    colorScheme,
    graph,
    setGraph,
    rankingFilter,
    navigatorPublicKey,
    transactionRange,
    requestPkTransactions,
  } =
    useContext(AppContext);

  const [peekGraphKey, setPeekGraphKey] = useState<string>('/');
  const whichKey = useMemo(() => toDisplayPath(peekGraphKey), [peekGraphKey]);

  const [presentFilterModal, dismissFilter] = useIonModal(Filter, {
    onDismiss: () => dismissFilter(),
    value: rankingFilter,
  });

  const [presentBlockModal, dismissBlock] = useIonModal(Sequence, {
    onDismiss: (data: string, role: string) => dismissBlock(data, role),
  });

  const [presentPointModal, dismissPoint] = useIonModal(Assert, {
    onDismiss: (data: string, role: string) => dismissPoint(data, role),
    forKey: whichKey,
  });

  const [presentSocketConsole, dismissSocketConsole] = useIonModal(
    WebsocketConsole,
    {
      onDismiss: () => dismissSocketConsole(),
    },
  );

  useEffect(() => {
    let cleanup = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!navigatorPublicKey) {
        setGraph(null);
        return;
      }

      cleanup =
        requestPkTransactions(
          navigatorPublicKey,
          (transactions) => {
            setGraph(indexTransactionsToGraph(transactions, navigatorPublicKey));
          },
          {
            startHeight: transactionRange.startHeight,
            endHeight: transactionRange.endHeight,
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
    transactionRange.endHeight,
    transactionRange.limit,
    transactionRange.startHeight,
  ]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (whichKey && data.detail) {
        if (!navigatorPublicKey) {
          return;
        }
        requestPkTransactions(
          navigatorPublicKey,
          (transactions) => {
            setGraph(indexTransactionsToGraph(transactions, navigatorPublicKey));
          },
          {
            startHeight: transactionRange.startHeight,
            endHeight: transactionRange.endHeight,
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
    setGraph,
    transactionRange.endHeight,
    transactionRange.limit,
    transactionRange.startHeight,
    whichKey,
  ]);

  return (
    <PageShell
      tools={[
        {
          label: 'Filter',
          renderIcon: () => <IonIcon
            slot="icon-only"
            icon={optionsOutline}
          />,
          action: () => presentFilterModal(),
        },
        {
          label: 'Sequence',
          renderIcon: () => <IonIcon
            slot="icon-only"
            icon={timerOutline}
          />,
          action: () => presentBlockModal(),
        },
        {
          label: 'Assert',
          renderIcon: () => <IonIcon
            slot="icon-only"
            icon={addCircleOutline}
          />,
          action: () => presentPointModal(),
        },
        {
          label: 'WebSocket console',
          renderIcon: () => <IonIcon slot="icon-only" icon={terminalOutline} />,
          action: () => presentSocketConsole(),
        },
      ]}
      renderBody={() => (
        <>
          {!!whichKey && (
            <>
              {!!graph && (
                <DirTree
                  forKey={whichKey}
                  nodes={graph.nodes ?? []}
                  links={graph.links ?? []}
                  setForKey={setPeekGraphKey}
                  colorScheme={colorScheme}
                />
              )}
            </>
          )}
        </>
      )}
    />
  );
};

export default Explore;
