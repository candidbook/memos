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

const toDisplayPath = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue || '/';
};

const toRequestPath = (value: string) => {
  const displayPath = toDisplayPath(value);
  const normalized = displayPath === '/' ? displayPath : `${displayPath.replace(/\/+$/g, '')}/`;
  return `${normalized.padEnd(43, '0')}=`;
};

const Explore = () => {
  const { colorScheme, graph, requestGraph, rankingFilter } =
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
    const timeoutId = window.setTimeout(() => {
      if (whichKey) {
        requestGraph(toRequestPath(whichKey));
      }
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [whichKey, requestGraph]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (whichKey && data.detail) {
        requestGraph(toRequestPath(whichKey));
      }
    };

    document.addEventListener('inv_block', resultHandler);

    return () => {
      document.removeEventListener('inv_block', resultHandler);
    };
  }, [whichKey, requestGraph]);

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
