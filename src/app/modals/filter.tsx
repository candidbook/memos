import { useContext } from 'react';
import {
  IonButton,
  IonItem,
  IonList,
  IonRange,
} from '@ionic/react';
import { AppContext } from '../utils/appContext';

const Filter = ({
  onDismiss,
  value,
}: {
  onDismiss: () => void;
  value: number;
}) => {
  const { rankingFilter, setRankingFilter } = useContext(AppContext);

  return (
    <div className="ion-padding">
      <IonList>
        <IonItem>
          <IonRange
            aria-label="Ranking filter"
            labelPlacement="start"
            label={`Filter < ${value}%`}
            pin={true}
            pinFormatter={(value: number) => `${value}%`}
            onIonChange={({ detail }) => setRankingFilter(Number(detail.value))}
            value={rankingFilter}
          />
        </IonItem>
      </IonList>
      <IonButton expand="block" onClick={onDismiss}>
        Done
      </IonButton>
    </div>
  );
};

export default Filter;